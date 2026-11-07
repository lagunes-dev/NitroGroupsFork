using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Abstractions.Repository;

namespace NitroGroups.Core.Groups.Application.Abstractions
{
    public interface IUnitOfWorkGroups : IUnitOfWork
    {
        IGenericRepository<Group, long> Groups { get; }
        IGenericRepository<GroupMember, long> GroupMembers { get; }
        IGenericRepository<MusicGenre, long> MusicGenres { get; }
        IGenericRepository<GroupGenre, long> GroupGenres { get; }
        IGenericRepository<GroupMedia, long> GroupMedia { get; }
        IGroupSearchRepository GroupSearch { get; }
        IGroupMembershipRequestRepository MembershipRequests { get; }
    }
}
