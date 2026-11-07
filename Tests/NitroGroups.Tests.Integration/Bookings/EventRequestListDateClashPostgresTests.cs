using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests.List;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Core.Bookings.Infrastructure.Persistence;
using NitroGroups.Tests.Integration.Infrastructure;
using static NitroGroups.Tests.Integration.Bookings.BookingsTestScenario;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// T29 contra PostgreSQL real: una página de varios pedidos resuelve el choque de fecha de todas
/// sus filas con <b>una sola</b> lectura agrupada de los toques aceptados de esos días —nunca una
/// consulta por renglón— y la columna <c>date</c> se compara en SQL con su tipo real.
/// </summary>
public class EventRequestListDateClashPostgresTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private static readonly DateOnly Day1 = new(2027, 2, 20);
    private static readonly DateOnly Day2 = new(2027, 2, 27);
    private static readonly DateOnly EmptyDay = new(2027, 3, 6);

    private readonly IntegrationTestFixture _fixture = fixture;
    private readonly BookingsTestScenario _scenario = new();

    private static BookingsDbContext Context(string connectionString, CountingCommandInterceptor counter)
        => new(new DbContextOptionsBuilder<BookingsDbContext>()
            .UseNpgsql(connectionString)
            .AddInterceptors(counter)
            .Options);

    private static async Task<EventRequest> SeedAsync(
        BookingsDbContext context,
        DateOnly eventDate,
        TimeOnly? startTime = null,
        bool accepted = false,
        string eventType = "Boda")
    {
        var request = new EventRequest
        {
            GroupId = GroupId,
            ClientUserId = ClientId,
            EventDate = eventDate,
            StartTime = startTime,
            DurationHours = 3,
            EventType = eventType,
            LocationText = "Hacienda San Gabriel",
            Message = "Boda con banda en vivo."
        };
        if (accepted)
            request.Accept(null, Now.UtcDateTime);
        request.ClearDomainEvents();
        context.EventRequests.Add(request);
        await context.SaveChangesAsync();
        return request;
    }

    [PostgresFact]
    public async Task PaginaDeVariosPedidos_ResuelveElChoqueConUnaSolaLecturaDeLosToquesAceptados()
    {
        await using var database = await PostgresTestDatabase.CreateAsync();
        var counter = new CountingCommandInterceptor();
        await using var context = Context(database.ConnectionString, counter);
        await context.Database.MigrateAsync();

        // Página de cuatro pedidos en tres días distintos.
        var tarde = await SeedAsync(context, Day1, new TimeOnly(21, 0));
        var manana = await SeedAsync(context, Day1, new TimeOnly(10, 0));
        var segundoDia = await SeedAsync(context, Day2, new TimeOnly(18, 0));
        var diaLibre = await SeedAsync(context, EmptyDay, new TimeOnly(18, 0));
        // Un toque aceptado por día con pedidos; ninguno el día libre.
        var boda = await SeedAsync(context, Day1, new TimeOnly(20, 0), accepted: true);
        var toqueDelSegundoDia = await SeedAsync(context, Day2, new TimeOnly(19, 0), accepted: true, eventType: "XV años");

        counter.Reset();

        var handler = new GetGroupEventRequestsQueryHandler(
            _fixture.CreateBookingsUnitOfWork(context), _scenario.Groups, _scenario.Users, _scenario.Time);
        var rows = await handler.Handle(new GetGroupEventRequestsQuery(GroupId, null), CancellationToken.None);

        Assert.Equal(6, rows.Count);

        // El de las 21:00 se pisa con la boda de las 20:00; el de las 10:00 no se pisa con nadie.
        var rowTarde = rows.Single(r => r.Id == tarde.Id);
        Assert.True(rowTarde.DateClash!.Clashes);
        Assert.Equal(boda.Id, rowTarde.DateClash.WithGig!.Id);
        Assert.Equal("20:00", rowTarde.DateClash.WithGig.StartTime);
        Assert.Equal(3, rowTarde.DateClash.WithGig.DurationHours);
        Assert.Equal("Boda", rowTarde.DateClash.WithGig.EventType);

        var rowManana = rows.Single(r => r.Id == manana.Id);
        Assert.Equal(boda.Id, rowManana.DateClash!.WithGig!.Id);

        var rowSegundoDia = rows.Single(r => r.Id == segundoDia.Id);
        Assert.Equal(toqueDelSegundoDia.Id, rowSegundoDia.DateClash!.WithGig!.Id);
        Assert.Equal("XV años", rowSegundoDia.DateClash.WithGig.EventType);

        Assert.Null(rows.Single(r => r.Id == diaLibre.Id).DateClash);

        // Una lectura de la lista + una lectura agrupada de los toques aceptados de esos días.
        // Con una consulta por renglón esta página habría hecho cuatro lecturas más.
        var requestReads = counter.Commands.Where(command => command.Contains("event_requests")).ToList();
        Assert.Equal(2, requestReads.Count);
    }

    /// <summary>Cuenta las lecturas que llegan a la base para poder exigir una sola por página.</summary>
    private sealed class CountingCommandInterceptor : DbCommandInterceptor
    {
        public List<string> Commands { get; } = [];

        public void Reset() => Commands.Clear();

        public override InterceptionResult<DbDataReader> ReaderExecuting(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result)
        {
            Commands.Add(command.CommandText);
            return base.ReaderExecuting(command, eventData, result);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Commands.Add(command.CommandText);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
