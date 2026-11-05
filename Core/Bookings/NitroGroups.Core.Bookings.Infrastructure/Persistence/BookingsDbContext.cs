using Microsoft.EntityFrameworkCore;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Infrastructure.Persistence;

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence;

public class BookingsDbContext(DbContextOptions<BookingsDbContext> options) : ModuleDbContext(options)
{
    public const string SchemaName = "bookings";

    public override string Schema => SchemaName;

    public DbSet<EventRequest> EventRequests => Set<EventRequest>();
    public DbSet<EventRequestMessage> EventRequestMessages => Set<EventRequestMessage>();
    public DbSet<GigAttendance> GigAttendances => Set<GigAttendance>();
    public DbSet<GigPay> GigPays => Set<GigPay>();
}
