using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests;

/// <summary>Arma las respuestas consultando grupos y usuarios por sus contratos de módulo.</summary>
public static class EventRequestResponses
{
    public static async Task<List<EventRequestResponse>> BuildAsync(
        IReadOnlyCollection<EventRequest> requests,
        IGroupsModuleApi groups,
        IUsersModuleApi users,
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

        return requests.Select(r => Map(r, groupMap.GetValueOrDefault(r.GroupId), userMap, includeMessages)).ToList();
    }

    public static async Task<EventRequestResponse> BuildAsync(
        EventRequest request,
        IGroupsModuleApi groups,
        IUsersModuleApi users,
        bool includeMessages,
        CancellationToken cancellationToken)
        => (await BuildAsync([request], groups, users, includeMessages, cancellationToken))[0];

    /// <summary>Privacidad: el grupo solo ve el nombre y la inicial del apellido del cliente.</summary>
    public static string ShortName(UserSummary? user)
    {
        if (user is null || string.IsNullOrWhiteSpace(user.FirstName))
            return "Cliente";

        var last = user.LastName?.Trim();
        return string.IsNullOrEmpty(last) ? user.FirstName.Trim() : $"{user.FirstName.Trim()} {char.ToUpperInvariant(last[0])}.";
    }

    private static EventRequestResponse Map(
        EventRequest r,
        GroupSummary? group,
        IReadOnlyDictionary<long, UserSummary> users,
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
            Deposit = new GigDepositResponse { Amount = r.DepositAmount, ReceivedAt = r.DepositReceivedAt },
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
