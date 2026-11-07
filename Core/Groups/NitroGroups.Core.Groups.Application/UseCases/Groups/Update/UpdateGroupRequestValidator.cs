using FluentValidation;
using NitroGroups.Shared.Contracts.Groups.Requests;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.Update;

/// <summary>
/// Solo la regla del campo nuevo (ronda 9). El endpoint de actualización no tenía validador y no se
/// le agregan reglas a los campos que ya existían: eso cambiaría lo que hoy acepta un guardado de
/// perfil, que es un cambio de comportamiento que nadie pidió. Cómo pagar sí entra con su tope, para
/// que una respuesta del formulario sea un 400 que se puede corregir y no un error de la base.
/// </summary>
public class UpdateGroupRequestValidator : AbstractValidator<UpdateGroupRequest>
{
    public UpdateGroupRequestValidator()
    {
        RuleFor(x => x.PaymentInstructions)
            .MaximumLength(500)
            .WithMessage("Cómo pagar no puede pasar de 500 caracteres.");
    }
}
