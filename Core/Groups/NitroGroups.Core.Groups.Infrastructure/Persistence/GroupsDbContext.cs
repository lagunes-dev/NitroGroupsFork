using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Infrastructure.Persistence;

namespace NitroGroups.Core.Groups.Infrastructure.Persistence
{
    public class GroupsDbContext(DbContextOptions<GroupsDbContext> options) : ModuleDbContext(options)
    {
        public const string SchemaName = "groups";

        public override string Schema => SchemaName;

        public DbSet<Group> Groups => Set<Group>();
        public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
        public DbSet<MusicGenre> MusicGenres => Set<MusicGenre>();
        public DbSet<GroupGenre> GroupGenres => Set<GroupGenre>();
        public DbSet<GroupMedia> GroupMedia => Set<GroupMedia>();
        public DbSet<GroupMembershipRequest> GroupMembershipRequests => Set<GroupMembershipRequest>();
    }
}
