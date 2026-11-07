using NitroGroups.Shared.Domain;

namespace NitroGroups.Core.Groups.Domain.Entities;

public class Group : AuditableModel
{
    public long OwnerUserId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Biography { get; set; } = string.Empty;
    public int NumMembers { get; set; }
    public int YearsExperience { get; set; }
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string LocationText { get; set; } = string.Empty;
    public int ServiceRadiusKm { get; set; }
    public string Currency { get; set; } = string.Empty;
    public decimal? BasePrice { get; set; }
    public decimal? HourlyRate { get; set; }
    public int MinimumDurationHours { get; set; }
    public int SetupTimeMinutes { get; set; }
    public decimal AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public int ViewCount { get; set; }
    public int BookingCount { get; set; }
    public bool IsVerified { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsAcceptingBookings { get; set; }
    public bool Active { get; set; }

    // Images
    public string? ProfilePictureUrl { get; set; }
    public string? CoverImageUrl { get; set; }

    /// <summary>
    /// Cómo quiere el grupo que se le pague (ronda 9, D1/S18): texto libre de hasta 500 caracteres
    /// que escribe el manager en su perfil. La app no cobra, no valida datos bancarios y no mueve
    /// dinero: solo repite lo que el grupo dijo. Solo lo lee el cliente de un evento aceptado.
    /// Null cuando nadie lo cargó: el texto vacío no es un dato.
    /// </summary>
    public string? PaymentInstructions { get; set; }

    /// <summary>
    /// Cuándo cambió el texto por última vez (UTC), para que la nota diga "Actualizado el …". Se
    /// mueve solo cuando el texto cambia: editar la biografía no reescribe la fecha de cómo pagar.
    /// Null mientras no haya texto.
    /// </summary>
    public DateTime? PaymentInstructionsUpdatedAt { get; private set; }

    /// <summary>
    /// Guarda o limpia el texto de cómo pagar. Normaliza (recorta y convierte el vacío en null) y
    /// solo mueve la fecha cuando el texto cambió de verdad.
    /// </summary>
    public void SetPaymentInstructions(string? instructions, DateTime nowUtc)
    {
        var normalized = NormalizePaymentInstructions(instructions);
        if (normalized == NormalizePaymentInstructions(PaymentInstructions))
            return;

        PaymentInstructions = normalized;
        PaymentInstructionsUpdatedAt = normalized is null ? null : nowUtc;
    }

    /// <summary>Un texto vacío o solo con espacios no es una instrucción de pago: es null.</summary>
    public static string? NormalizePaymentInstructions(string? instructions)
        => string.IsNullOrWhiteSpace(instructions) ? null : instructions.Trim();

    // Navigation
    public virtual ICollection<GroupMember> Members { get; set; } = [];
    public virtual ICollection<GroupGenre> Genres { get; set; } = [];
    public virtual ICollection<GroupMedia> Media { get; set; } = [];
}
