using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.List;

/// <summary>Solicitudes que envió el usuario actual.</summary>
public sealed record GetMyEventRequestsQuery(long ClientUserId) : IQuery<List<EventRequestResponse>>;

/// <summary>
/// Solicitudes recibidas por un grupo. El endpoint exige RequireGroupManager sobre ese
/// mismo groupId, y aquí solo se devuelven solicitudes de ese grupo.
/// </summary>
public sealed record GetGroupEventRequestsQuery(long GroupId, EventRequestStatus? Status) : IQuery<List<EventRequestResponse>>;

public sealed class GetMyEventRequestsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time)
    : IQueryHandler<GetMyEventRequestsQuery, List<EventRequestResponse>>
{
    public async Task<List<EventRequestResponse>> Handle(GetMyEventRequestsQuery query, CancellationToken cancellationToken)
    {
        var requests = await unitOfWork.EventRequests.ListByClientAsync(query.ClientUserId, cancellationToken);
        var responses = await EventRequestResponses.BuildAsync(
            requests, groups, users, unitOfWork.EventReviews, time, query.ClientUserId, includeMessages: false, cancellationToken);
        await AttachPaymentMethodsAsync(responses, cancellationToken);
        return responses;
    }

    /// <summary>
    /// Ronda 10: la fila del cliente responde "cómo pago" sin abrir el hilo y sin bajar una pantalla.
    /// Solo los pedidos aceptados llevan método —sin trato cerrado no hay pago— y el texto se lee
    /// <b>una vez por grupo distinto</b>, nunca una vez por renglón: la lista no se vuelve N+1.
    /// </summary>
    private async Task AttachPaymentMethodsAsync(
        List<EventRequestResponse> responses,
        CancellationToken cancellationToken)
    {
        var accepted = responses
            .Where(response => response.Status == EventRequestStatus.Accepted)
            .ToList();

        if (accepted.Count == 0)
            return;

        var byGroup = new Dictionary<long, string?>();
        foreach (var groupId in accepted.Select(response => response.GroupId).Distinct())
        {
            var instructions = await groups.GetPaymentInstructionsAsync(groupId, cancellationToken);
            byGroup[groupId] = PaymentMethodLine.From(instructions?.Text);
        }

        foreach (var response in accepted)
            response.PaymentMethod = byGroup.GetValueOrDefault(response.GroupId);
    }
}

public sealed class GetGroupEventRequestsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time)
    : IQueryHandler<GetGroupEventRequestsQuery, List<EventRequestResponse>>
{
    public async Task<List<EventRequestResponse>> Handle(GetGroupEventRequestsQuery query, CancellationToken cancellationToken)
    {
        var requests = await unitOfWork.EventRequests.ListByGroupAsync(query.GroupId, query.Status, cancellationToken);
        var dateClashes = await DateClashesAsync(query.GroupId, requests, cancellationToken);

        // La bandeja es del grupo: quien la mira administra el evento, no puede reseñarlo.
        var responses = await EventRequestResponses.BuildAsync(
            requests, groups, users, unitOfWork.EventReviews, time, callerUserId: null, includeMessages: false, cancellationToken);

        // T29: el choque de fecha viaja en la fila para que el manager decida sin abrir el hilo.
        foreach (var response in responses)
            response.DateClash = dateClashes.GetValueOrDefault(response.Id);

        return responses;
    }

    /// <summary>
    /// T29: el choque de todas las filas sale de <b>una sola</b> lectura agrupada de los toques
    /// aceptados del grupo en los días de la página, nunca de una consulta por renglón.
    /// </summary>
    private async Task<Dictionary<long, DateClashSignalResponse?>> DateClashesAsync(
        long groupId,
        IReadOnlyCollection<EventRequest> requests,
        CancellationToken cancellationToken)
    {
        if (requests.Count == 0)
            return [];

        var days = requests.Select(request => request.EventDate).Distinct().ToList();
        var accepted = await unitOfWork.EventRequests.ListAcceptedOnDatesAsync([groupId], days, cancellationToken);
        var acceptedByDay = accepted.ToLookup(gig => gig.EventDate);

        return requests.ToDictionary(
            request => request.Id,
            request => DateClashSelection.SignalOrNull(DateClashSelection.Pick(request, acceptedByDay[request.EventDate])));
    }
}
