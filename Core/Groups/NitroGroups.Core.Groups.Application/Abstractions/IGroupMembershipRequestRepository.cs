using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Application.Abstractions;

/// <summary>Lectura y alta de invitaciones/solicitudes de membresía.</summary>
public interface IGroupMembershipRequestRepository : IGenericRepository<GroupMembershipRequest, long>
{
    /// <summary>
    /// La solicitud pendiente entre ese grupo y ese músico, sin importar el sentido, o null.
    /// Solo puede haber una: lo garantiza un índice único parcial.
    /// </summary>
    Task<GroupMembershipRequest?> GetPendingAsync(long groupId, long musicianUserId, CancellationToken cancellationToken = default);

    /// <summary>Bandeja del grupo, las más nuevas primero.</summary>
    Task<List<GroupMembershipRequest>> ListByGroupAsync(
        long groupId,
        MembershipDirection? direction,
        MembershipRequestStatus? status,
        CancellationToken cancellationToken = default);

    /// <summary>Bandeja del músico (invitaciones recibidas y solicitudes que hizo), las más nuevas primero.</summary>
    Task<List<GroupMembershipRequest>> ListByMusicianAsync(
        long musicianUserId,
        MembershipDirection? direction,
        MembershipRequestStatus? status,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Crea la solicitud pendiente y la guarda. Devuelve false si ya había otra pendiente para ese
    /// (grupo, músico): el índice único parcial se traduce aquí en vez de reventar con un 500.
    /// </summary>
    Task<bool> TryCreatePendingAsync(GroupMembershipRequest request, CancellationToken cancellationToken = default);
}
