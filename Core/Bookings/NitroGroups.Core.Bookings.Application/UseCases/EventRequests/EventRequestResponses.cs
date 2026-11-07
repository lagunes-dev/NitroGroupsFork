using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests;

/// <summary>Arma las respuestas consultando grupos y usuarios por sus contratos de módulo.</summary>
public static class EventRequestResponses
{
    /// <param name="callerUserId">El usuario del token, para saber si es él quien puede reseñar.</param>
    /// <param name="time">Reloj de la regla "la fecha ya pasó" (hora de México).</param>
    public static async Task<List<EventRequestResponse>> BuildAsync(
        IReadOnlyCollection<EventRequest> requests,
        IGroupsModuleApi groups,
        IUsersModuleApi users,
        IEventReviewRepository reviews,
        TimeProvider time,
        long? callerUserId,
        bool includeMessages,
        CancellationToken cancellationToken)
    {
        if (requests.Count == 0)
            return [];

        var groupMap = await groups.GetGroupsAsync(requests.Select(r => r.GroupId), cancellationToken);

        var userIds = requests.Select(r => r.ClientUserId);
        if (includeMessages)
            userIds = userIds.Concat(requests.SelectMany(r => r.Messages).Select(m => m.SenderUserId));
        var userMap = await users.GetUsersAsync(userIds.Distinct(), cancellationToken);

        var reviewsByRequest = (await reviews.ListByEventRequestsAsync(
                requests.Select(r => r.Id).ToList(), cancellationToken))
            .ToDictionary(review => review.EventRequestId);
        var today = MexicoTime.Today(time);

        return requests.Select(r => Map(
            r,
            groupMap.GetValueOrDefault(r.GroupId),
            userMap,
            reviewsByRequest.GetValueOrDefault(r.Id),
            today,
            callerUserId,
            includeMessages)).ToList();
    }

    public static async Task<EventRequestResponse> BuildAsync(
        EventRequest request,
        IGroupsModuleApi groups,
        IUsersModuleApi users,
        IEventReviewRepository reviews,
        TimeProvider time,
        long? callerUserId,
        bool includeMessages,
        CancellationToken cancellationToken)
        => (await BuildAsync([request], groups, users, reviews, time, callerUserId, includeMessages, cancellationToken))[0];

    /// <summary>Privacidad: el grupo solo ve el nombre y la inicial del apellido del cliente.</summary>
    public static string ShortName(UserSummary? user)
    {
        if (user is null || string.IsNullOrWhiteSpace(user.FirstName))
            return "Cliente";

        var last = user.LastName?.Trim();
        return string.IsNullOrEmpty(last) ? user.FirstName.Trim() : $"{user.FirstName.Trim()} {char.ToUpperInvariant(last[0])}.";
    }

    /// <summary>
    /// S5: el llamante es el cliente del evento, el evento está aceptado, su fecha ya pasó en
    /// hora de México, no es autorreserva y todavía no tiene reseña.
    /// </summary>
    public static bool CanReview(EventRequest request, EventReview? review, DateOnly today, long? callerUserId)
        => callerUserId is { } caller
            && request.ClientUserId == caller
            && review is null
            && request.Status == EventRequestStatus.Accepted
            && !request.IsSelfBooked
            && request.EventDate < today;

    private static EventRequestResponse Map(
        EventRequest r,
        GroupSummary? group,
        IReadOnlyDictionary<long, UserSummary> users,
        EventReview? review,
        DateOnly today,
        long? callerUserId,
        bool includeMessages)
    {
        var groupName = group?.GroupName ?? string.Empty;

        return new EventRequestResponse
        {
            Id = r.Id,
            GroupId = r.GroupId,
            GroupName = groupName,
            GroupSlug = group?.Slug ?? string.Empty,
            ClientName = ShortName(users.GetValueOrDefault(r.ClientUserId)),
            EventDate = r.EventDate,
            StartTime = r.StartTime,
            DurationHours = r.DurationHours,
            EventType = r.EventType,
            LocationText = r.LocationText,
            GuestCount = r.GuestCount,
            Budget = r.Budget,
            Currency = r.Currency,
            Message = r.Message,
            Status = r.Status,
            IsSelfBooked = r.IsSelfBooked,
            CreatedAt = r.CreatedAt,
            RespondedAt = r.RespondedAt,
            ResponseMessage = r.ResponseMessage,
            Deposit = new GigDepositResponse { Amount = r.DepositAmount, ReceivedAt = r.DepositReceivedAt, DueDate = r.DepositDueDate },
            BalanceReceivedAt = r.BalanceReceivedAt,
            BalanceDueDate = r.BalanceDueDate,
            CanReview = CanReview(r, review, today, callerUserId),
            Review = review is null
                ? null
                : new EventReviewResponse { Rating = review.Rating, Comment = review.Comment, CreatedAt = review.CreatedAt },
            Messages = includeMessages
                ? r.Messages
                    .OrderBy(m => m.CreatedAt).ThenBy(m => m.Id)
                    .Select(m => new EventRequestMessageResponse
                    {
                        Id = m.Id,
                        SenderUserId = m.SenderUserId,
                        SenderParty = m.SenderParty,
                        SenderName = m.SenderParty == EventRequestParty.Group
                            ? groupName
                            : ShortName(users.GetValueOrDefault(m.SenderUserId)),
                        Body = m.Body,
                        CreatedAt = m.CreatedAt
                    })
                    .ToList()
                : null
        };
    }
}
