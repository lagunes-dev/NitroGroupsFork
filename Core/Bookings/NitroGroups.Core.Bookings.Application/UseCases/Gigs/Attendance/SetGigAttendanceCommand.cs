using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.Attendance;

/// <param name="UserId">Siempre el usuario del token (lo pone el endpoint).</param>
/// <param name="Status">"Confirmed" o "Declined"; lo valida el handler.</param>
public sealed record SetGigAttendanceCommand(long GigId, long UserId, string? Status)
    : ICommand<BookingResult<GigAttendanceResponse>>;

/// <summary>
/// S3 y S4: el miembro confirma o rechaza un toque. Quien no es miembro activo del grupo del
/// toque recibe el mismo 404 que un toque inexistente, para no revelar que existe.
/// </summary>
public sealed class SetGigAttendanceCommandHandler(IUnitOfWorkBookings unitOfWork, IGroupsModuleApi groups)
    : ICommandHandler<SetGigAttendanceCommand, BookingResult<GigAttendanceResponse>>
{
    internal const string NotFoundMessage = "Toque no encontrado.";
    internal const string InvalidStatusMessage = "La asistencia debe ser \"Confirmed\" o \"Declined\".";

    public async Task<BookingResult<GigAttendanceResponse>> Handle(SetGigAttendanceCommand command, CancellationToken cancellationToken)
    {
        var gig = await unitOfWork.EventRequests.GetWithAttendanceAsync(command.GigId, cancellationToken);
        if (gig is null || gig.Status != EventRequestStatus.Accepted)
            return BookingResult<GigAttendanceResponse>.Failure(BookingErrorKind.NotFound, NotFoundMessage);

        // El permiso sale del grupo guardado en el toque, nunca de la ruta ni del cuerpo.
        var memberships = await groups.GetUserGroupMembershipsAsync(command.UserId, cancellationToken);
        if (!memberships.Any(membership => membership.GroupId == gig.GroupId))
            return BookingResult<GigAttendanceResponse>.Failure(BookingErrorKind.NotFound, NotFoundMessage);

        if (!GigAttendanceStatuses.TryParse(command.Status, out var status))
            return BookingResult<GigAttendanceResponse>.Failure(BookingErrorKind.Validation, InvalidStatusMessage);

        var attendance = gig.RespondAttendance(command.UserId, status);
        await unitOfWork.CompleteAsync();

        return BookingResult<GigAttendanceResponse>.Success(new GigAttendanceResponse
        {
            Id = gig.Id,
            Attendance = attendance.Status.ToString()
        });
    }
}
