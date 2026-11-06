using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.List;

/// <summary>
/// S1 y S4: los toques de los grupos donde el usuario tiene membresía activa. Los grupos salen
/// solo del contrato de Groups, nunca de su esquema.
/// </summary>
public sealed record GetMyGigsQuery(long UserId) : IQuery<List<GigResponse>>;

/// <summary>
/// La agenda del músico es la única vista donde viajan el teléfono del manager del grupo y quiénes
/// tocan el toque (S22). Los dos datos se piden a los contratos de Groups y de Users, solo para los
/// grupos donde el llamante tiene membresía activa: quien no es miembro activo no ve la fila.
/// </summary>
public sealed class GetMyGigsQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time) : IQueryHandler<GetMyGigsQuery, List<GigResponse>>
{
    public async Task<List<GigResponse>> Handle(GetMyGigsQuery query, CancellationToken cancellationToken)
    {
        var memberships = await groups.GetUserGroupMembershipsAsync(query.UserId, cancellationToken);
        if (memberships.Count == 0)
            return [];

        var groupIds = memberships.Select(membership => membership.GroupId).Distinct().ToList();
        var gigs = await unitOfWork.EventRequests.ListAcceptedGigsAsync(
            groupIds,
            GigAgenda.FirstVisibleDate(time),
            cancellationToken);

        if (gigs.Count == 0)
            return [];

        var gigIds = gigs.Select(gig => gig.Id).ToList();

        // Todas las respuestas de esos toques: la del llamante para su chip y las confirmadas para
        // armar quiénes tocan.
        var attendance = await unitOfWork.GigAttendances.ListByEventRequestsAsync(gigIds, cancellationToken);

        var pay = await unitOfWork.GigPays.ListByEventRequestsAsync(gigIds, query.UserId, cancellationToken);

        // Nombres de quienes tocan, solo por el contrato de Users.
        var teammateIds = attendance
            .Where(row => row.Status == GigAttendanceStatus.Confirmed)
            .Select(row => row.UserId)
            .Distinct()
            .ToList();
        var userMap = await users.GetUsersAsync(teammateIds, cancellationToken);
        var musicianMap = await users.GetMusicianSummariesAsync(teammateIds, cancellationToken);

        // El rol de cada compañero sale del contrato de Groups, grupo por grupo: es el rol dentro
        // del grupo (Dueño, Manager, Miembro), no el instrumento del perfil.
        var rolesByGroup = new Dictionary<long, IReadOnlyDictionary<long, string>>();
        foreach (var groupId in groupIds)
            rolesByGroup[groupId] = await groups.GetActiveMemberRolesAsync(groupId, teammateIds, cancellationToken);
        var groupOfGig = gigs.ToDictionary(gig => gig.Id, gig => gig.GroupId);

        var groupsById = await groups.GetGroupsAsync(groupIds, cancellationToken);

        // Solo la respuesta del llamante alimenta su chip: las de los demás no son asunto suyo. El
        // valor es nullable a propósito: "Confirmed" es 0, así que un diccionario de enum devolvería
        // confirmado para quien no respondió.
        var mine = attendance
            .Where(row => row.UserId == query.UserId)
            .ToDictionary(row => row.EventRequestId, row => (GigAttendanceStatus?)row.Status);
        var teammates = attendance
            .GroupBy(row => row.EventRequestId)
            .ToDictionary(
                rows => rows.Key,
                rows => GigResponses.Teammates(
                    rows,
                    query.UserId,
                    mine.GetValueOrDefault(rows.Key),
                    userMap,
                    musicianMap,
                    rolesByGroup.GetValueOrDefault(groupOfGig.GetValueOrDefault(rows.Key)) ?? new Dictionary<long, string>()));

        return GigResponses.Build(
            gigs,
            memberships.ToDictionary(membership => membership.GroupId),
            mine,
            pay.ToDictionary(row => row.EventRequestId, row => (row.Amount, row.PaidAt)),
            groupsById,
            teammates);
    }
}
