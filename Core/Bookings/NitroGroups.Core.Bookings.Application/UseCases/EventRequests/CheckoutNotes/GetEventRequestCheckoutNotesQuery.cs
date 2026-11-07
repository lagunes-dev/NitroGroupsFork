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
/// Las notas de pago del hilo del cliente, en este orden:
/// 1. el acuerdo: existe siempre que el pedido sea legible para ese cliente, con el nombre del
///    manager cuando Users lo puede dar (nunca su correo);
/// 2. el texto del grupo, solo cuando el grupo escribió algo en su perfil.
/// Quién puede leerlas: el cliente del pedido y solo si está aceptado. Cualquier otro caso responde
/// 404, igual que el detalle del pedido con alguien que no es parte: no se revela ni que existe.
/// </summary>
public sealed class GetEventRequestCheckoutNotesQueryHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users)
    : IQueryHandler<GetEventRequestCheckoutNotesQuery, BookingResult<List<CheckoutNoteResponse>>>
{
    public const string AgreementTitle = "Cómo pagar";
    public const string GroupInstructionsTitle = "Instrucciones del grupo";

    /// <summary>De qué se acordó el pago: hoy, en efectivo, que es lo que la app registra como dato.</summary>
    public const string CashAgreementBody = "Acordaste el pago en efectivo con el grupo.";

    /// <summary>Decisión 4: la línea fija que dice quién cobra. Viaja en cada nota.</summary>
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

        var notes = new List<CheckoutNoteResponse> { Agreement(managerName) };

        // El campo vacío no es un dato: sin texto del grupo no hay segunda nota, pero la del acuerdo
        // sigue estando (decisión 6).
        if (instructions is not null)
        {
            notes.Add(new CheckoutNoteResponse
            {
                Title = GroupInstructionsTitle,
                // Tal cual lo escribió el grupo: la app no lo reescribe ni lo resume.
                Body = instructions.Text,
                UserDescription = NoMiddlemanLine,
                UpdatedOn = MexicoTime.DayOf(instructions.UpdatedAt)
            });
        }

        return BookingResult<List<CheckoutNoteResponse>>.Success(notes);
    }

    /// <summary>
    /// El nombre del manager del grupo, cuando Users lo puede dar. Nunca su correo: el cliente trata
    /// con el grupo, no con una bandeja de entrada. Sin nombre legible, la frase se queda sin él.
    /// </summary>
    private async Task<string?> ManagerNameAsync(long? managerUserId, CancellationToken cancellationToken)
    {
        if (managerUserId is not > 0)
            return null;

        var user = await users.GetUserAsync(managerUserId.Value, cancellationToken);
        var name = user?.FullName;
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    private static CheckoutNoteResponse Agreement(string? managerName) => new()
    {
        Title = AgreementTitle,
        Body = string.IsNullOrEmpty(managerName) ? CashAgreementBody : $"{CashAgreementBody} Te atiende {managerName}.",
        UserDescription = NoMiddlemanLine
    };
}
