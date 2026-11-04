using NitroGroups.Core.Users.Application.Abstractions;
using NitroGroups.Core.Users.Domain.Entities;
using NitroGroups.Core.Users.Infrastructure.Persistence;
using NitroGroups.Shared.Abstractions.Repository;
using NitroGroups.Shared.Abstractions.Events;
using NitroGroups.Shared.Infrastructure.Repository;

namespace NitroGroups.Core.Users.Infrastructure
{
    public class UnitOfWorkUser(
        UsersDbContext context,
        IOutboxService outboxService,
        IGenericRepository<User, long> users,
        IGenericRepository<Musician, long> musicians,
        IOpenMusicianSearchRepository openMusicians) : UnitOfWork(context, outboxService), IUnitOfWorkUser
    {
        public IGenericRepository<User, long> Users { get; } = users;
        public IGenericRepository<Musician, long> Musicians { get; } = musicians;
        public IOpenMusicianSearchRepository OpenMusicians { get; } = openMusicians;
    }
}
