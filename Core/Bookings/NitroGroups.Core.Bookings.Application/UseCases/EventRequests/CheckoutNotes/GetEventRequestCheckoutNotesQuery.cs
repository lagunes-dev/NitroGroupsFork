using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.EventRequests.CheckoutNotes;

/// <summary>
/// Ronda 9: cómo pagar, para el cliente de un evento aceptado. La app no cobra ni mueve dinero
/// (D1/S18); esto solo dice cómo quiere el grupo que se le pague.
/// </summary>
/// <param name="EventRequestId">El pedido que el cliente está mirando.</param>
/// <param name="UserId">El usuario del token; nunca sale de la ruta (evita IDOR).</param>
public sealed record GetEventRequestCheckoutNotesQuery(long EventRequestId, long? UserId)
    : IQuery<BookingResult<List<CheckoutNoteResponse>>>;

/// <summary>
/// La nota de pago del hilo del cliente. Es <b>una</b> y es la única que enuncia el método (ronda 10):
/// 1. si el grupo escribió cómo quiere que se le pague, ese texto es el método, tal cual, con el
///    nombre del manager en su propia línea;
/// 2. si el grupo no escribió nada, la nota no inventa un método: dice que el pago se acuerda con el
///    grupo y nombra a quien atiende, nada más.
/// Quién puede leerla: el cliente del pedido y solo si está aceptado. Cualquier otro caso responde
/// 404, igual que el detalle del pedido con alguien que no es parte: no se revela ni que existe.
/// </summary>
public sealed class GetEventRequestCheckoutNotesQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users)
    : IQueryHandler<GetEventRequestCheckoutNotesQuery, BookingResult<List<CheckoutNoteResponse>>>
{
    public const string NoteTitle = "Cómo pagar";

    /// <summary>
    /// Cuando el grupo no escribió nada: se dice con quién se acuerda y nada más. Nombrar un método
    /// sería afirmar un acuerdo que nadie hizo —"en efectivo" era exactamente eso (ronda 10).
    /// </summary>
    public const string AgreedWithGroupBody = "Acuerdas el pago con el grupo.";

    /// <summary>Decisión 4: la línea fija que dice quién cobra. Viaja en la nota.</summary>
    public const string NoMiddlemanLine = "Pagas directo al grupo; NitroGroups no cobra ni interviene.";

    public async Task<BookingResult<List<CheckoutNoteResponse>>> Handle(
        GetEventRequestCheckoutNotesQuery query,
        CancellationToken cancellationToken)
    {
        var request = await unitOfWork.EventRequests.GetByIdAsync(query.EventRequestId);

        // El pedido de otro cliente, uno que no existe, uno pendiente y uno rechazado responden lo
        // mismo: 404. Una nota de pago es información del trato cerrado, y decir "existe pero no
        // puedes" ya contaría algo.
        if (request is null
            || query.UserId is not { } caller
            || request.ClientUserId != caller
            || request.Status != EventRequestStatus.Accepted)
            return BookingResult<List<CheckoutNoteResponse>>.NotFound();

        var group = await groups.GetGroupAsync(request.GroupId, cancellationToken);
        var managerName = await ManagerNameAsync(group?.OwnerUserId, cancellationToken);
        var instructions = await groups.GetPaymentInstructionsAsync(request.GroupId, cancellationToken);

        var note = new CheckoutNoteResponse
        {
            Title = NoteTitle,
            // El texto del grupo se repite tal cual y es el único método que se enuncia: la app no lo
            // reescribe, no lo resume y no le agrega otro método arriba.
            Body = instructions?.Text ?? AgreedWithGroupBody,
            ManagerLine = ManagerLine(managerName),
            UserDescription = NoMiddlemanLine,
            // Sin texto del grupo no hay nada que se haya actualizado: la línea no lleva fecha.
            UpdatedOn = instructions is null ? null : MexicoTime.DayOf(instructions.UpdatedAt)
        };

        return BookingResult<List<CheckoutNoteResponse>>.Success([note]);
    }

    /// <summary>
    /// El nombre del manager del grupo, cuando Users lo puede dar. Nunca su correo: el cliente trata
    /// con el grupo, no con una bandeja de entrada. Sin nombre legible, la línea no se dibuja.
    /// </summary>
    private async Task<string?> ManagerNameAsync(long? managerUserId, CancellationToken cancellationToken)
    {
        if (managerUserId is not > 0)
            return null;

        var user = await users.GetUserAsync(managerUserId.Value, cancellationToken);
        var name = user?.FullName;
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    /// <summary>"Te atiende Mónica Salinas."; null cuando no hay nombre legible.</summary>
    public static string? ManagerLine(string? managerName)
        => string.IsNullOrWhiteSpace(managerName) ? null : $"Te atiende {managerName.Trim()}.";
}
