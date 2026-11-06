using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.Details;

/// <param name="GroupId">El grupo de la ruta; el endpoint ya exigió que el llamante lo administra.</param>
public sealed record UpdateGigDetailsCommand(long GroupId, long GigId, long? CallerUserId, UpdateGigDetailsBody Body)
    : ICommand<BookingResult<GroupGigResponse>>;

/// <summary>
/// S3 y S4: el manager guarda el setlist, la hora de llamado y el anticipo de un toque aceptado.
/// Es parcial: solo se tocan los campos enviados. Un toque de otro grupo o sin aceptar da 404.
/// </summary>
public sealed class UpdateGigDetailsCommandHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    TimeProvider time) : ICommandHandler<UpdateGigDetailsCommand, BookingResult<GroupGigResponse>>
{
    internal const string NotFoundMessage = "Toque no encontrado.";
    internal const int MaxSetlistLength = 4000;
    internal const decimal MaxAmount = 9_999_999_999.99m; // numeric(12,2)

    public async Task<BookingResult<GroupGigResponse>> Handle(UpdateGigDetailsCommand command, CancellationToken cancellationToken)
    {
        var gig = await unitOfWork.EventRequests.GetByIdAsync(command.GigId);
        if (gig is null || gig.GroupId != command.GroupId || gig.Status != EventRequestStatus.Accepted)
            return BookingResult<GroupGigResponse>.Failure(BookingErrorKind.NotFound, NotFoundMessage);

        var body = command.Body;
        if (body.HasSetlist && body.Setlist is { } setlist && setlist.Trim().Length > MaxSetlistLength)
            return Invalid($"El setlist no puede pasar de {MaxSetlistLength} caracteres.");
        if (body.HasDepositAmount && body.DepositAmount is < 0)
            return Invalid("El anticipo no puede ser negativo.");
        if (body.HasDepositAmount && body.DepositAmount > MaxAmount)
            return Invalid("El anticipo es demasiado grande.");

        if (body.HasSetlist)
            gig.SetSetlist(body.Setlist);
        if (body.HasCallTime)
            gig.SetCallTime(body.CallTime);
        if (body.HasDepositAmount)
            gig.SetDepositAmount(body.DepositAmount);
        if (body.HasDepositReceived && body.DepositReceived is { } received)
            gig.SetDepositReceived(received, time.GetUtcNow().UtcDateTime);
        if (body.HasBalanceReceived && body.BalanceReceived is { } balanceReceived)
            gig.SetBalanceReceived(balanceReceived, time.GetUtcNow().UtcDateTime);
        // S24: la fecha límite se guarda tal como viene, sin compararla con hoy: un plazo vencido es un
        // hecho que se muestra, no un error que se rechaza. Null la limpia y omitirla no la toca.
        if (body.HasDepositDueDate)
            gig.SetDepositDueDate(body.DepositDueDate);
        if (body.HasBalanceDueDate)
            gig.SetBalanceDueDate(body.BalanceDueDate);

        await unitOfWork.CompleteAsync();

        var rows = await GroupGigResponses.LoadAsync(
            unitOfWork, groups, users, command.GroupId, command.CallerUserId, [gig], cancellationToken);
        return BookingResult<GroupGigResponse>.Success(rows[0]);
    }

    private static BookingResult<GroupGigResponse> Invalid(string message)
        => BookingResult<GroupGigResponse>.Failure(BookingErrorKind.Validation, message);
}
