using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Contracts.Users.Responses;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.UseCases.MembershipRequests;

/// <summary>
/// Arma las respuestas de invitaciones y solicitudes. El nombre del músico sale del resumen sin
/// email del módulo Users; el del grupo se lee del propio módulo.
/// </summary>
public static class MembershipRequestResponses
{
    /// <summary>Si el músico borró su perfil, se muestra algo neutro en vez de un hueco.</summary>
    private const string UnknownMusician = "Músico";

    public static async Task<List<GroupMembershipRequestResponse>> BuildAsync(
        IReadOnlyCollection<GroupMembershipRequest> requests,
        IReadOnlyDictionary<long, Group> groups,
        IUsersModuleApi users,
        bool viewerIsGroupSide,
        CancellationToken cancellationToken)
    {
        if (requests.Count == 0)
            return [];

        var musicians = await users.GetMusicianSummariesAsync(
            requests.Select(r => r.MusicianUserId).Distinct(),
            cancellationToken);

        return requests
            .Select(r => Map(r, groups.GetValueOrDefault(r.GroupId), musicians, viewerIsGroupSide))
            .ToList();
    }

    public static async Task<GroupMembershipRequestResponse> BuildAsync(
        GroupMembershipRequest request,
        Group group,
        IUsersModuleApi users,
        bool viewerIsGroupSide,
        CancellationToken cancellationToken)
        => (await BuildAsync(
            [request],
            new Dictionary<long, Group> { [group.Id] = group },
            users,
            viewerIsGroupSide,
            cancellationToken))[0];

    private static GroupMembershipRequestResponse Map(
        GroupMembershipRequest request,
        Group? group,
        IReadOnlyDictionary<long, OpenMusicianSummary> musicians,
        bool viewerIsGroupSide)
    {
        var groupName = group?.GroupName ?? string.Empty;
        var musicianName = musicians.GetValueOrDefault(request.MusicianUserId)?.FullName ?? UnknownMusician;

        return new GroupMembershipRequestResponse
        {
            Id = request.Id,
            GroupId = request.GroupId,
            GroupName = groupName,
            GroupSlug = group?.Slug ?? string.Empty,
            MusicianUserId = request.MusicianUserId,
            MusicianName = musicianName,
            InitiatedByUserId = request.InitiatedByUserId,
            Direction = request.Direction,
            Status = request.Status,
            Message = request.Message,
            ResolvedByUserId = request.ResolvedByUserId,
            CreatedAt = request.CreatedAt,
            // El interceptor de auditoría lo mueve al resolverse; mientras está pendiente queda null.
            UpdatedAt = request.UpdatedAt,
            CounterpartName = viewerIsGroupSide ? musicianName : groupName
        };
    }
}
