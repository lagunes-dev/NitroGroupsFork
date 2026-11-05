using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Details;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.Pay;

/// <param name="GroupId">El grupo de la ruta; el endpoint ya exigió que el llamante lo administra.</param>
public sealed record SetGigPayCommand(long GroupId, long GigId, long? CallerUserId, SetGigPayBody Body)
    : ICommand<BookingResult<GroupGigResponse>>;

/// <summary>
/// D2 opción B: el manager registra cuánto se le paga a cada músico por el toque. La lista
/// REEMPLAZA el conjunto. Es informativo: no se suma ni se compara con el presupuesto.
/// </summary>
public sealed class SetGigPayCommandHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users) : ICommandHandler<SetGigPayCommand, BookingResult<GroupGigResponse>>
{
    public async Task<BookingResult<GroupGigResponse>> Handle(SetGigPayCommand command, CancellationToken cancellationToken)
    {
        var gig = await unitOfWork.EventRequests.GetByIdAsync(command.GigId);
        if (gig is null || gig.GroupId != command.GroupId || gig.Status != EventRequestStatus.Accepted)
            return BookingResult<GroupGigResponse>.Failure(BookingErrorKind.NotFound, UpdateGigDetailsCommandHandler.NotFoundMessage);

        if (command.Body.Payments is not { } payments)
            return Invalid("Envía la lista de pagos.");
        if (payments.Select(payment => payment.UserId).Distinct().Count() != payments.Count)
            return Invalid("Cada músico puede aparecer una sola vez.");
        if (payments.Any(payment => payment.Amount < 0))
            return Invalid("El pago no puede ser negativo.");
        if (payments.Any(payment => payment.Amount > UpdateGigDetailsCommandHandler.MaxAmount))
            return Invalid("El pago es demasiado grande.");

        var activeMembers = (await groups.GetActiveMemberUserIdsAsync(command.GroupId, cancellationToken)).ToHashSet();
        if (payments.Any(payment => !activeMembers.Contains(payment.UserId)))
            return Invalid("Solo se puede pagar a miembros activos del grupo.");

        var existing = await unitOfWork.GigPays.ListForReplaceAsync(gig.Id, cancellationToken);
        var wanted = payments.ToDictionary(payment => payment.UserId, payment => payment.Amount);

        foreach (var row in existing)
        {
            if (wanted.TryGetValue(row.UserId, out var amount))
            {
                // Revive la fila dada de baja: el índice único no admite una segunda para el mismo músico.
                row.DeletedAt = null;
                row.DeletedBy = null;
                row.Amount = amount;
            }
            else if (row.DeletedAt is null)
            {
                unitOfWork.GigPays.Delete(row);
            }
        }

        foreach (var (userId, amount) in wanted.Where(entry => existing.All(row => row.UserId != entry.Key)))
            await unitOfWork.GigPays.CreateAsync(new GigPay { EventRequestId = gig.Id, UserId = userId, Amount = amount });

        await unitOfWork.CompleteAsync();

        var rows = await GroupGigResponses.LoadAsync(
            unitOfWork, groups, users, command.GroupId, command.CallerUserId, [gig], cancellationToken);
        return BookingResult<GroupGigResponse>.Success(rows[0]);
    }

    private static BookingResult<GroupGigResponse> Invalid(string message)
        => BookingResult<GroupGigResponse>.Failure(BookingErrorKind.Validation, message);
}
