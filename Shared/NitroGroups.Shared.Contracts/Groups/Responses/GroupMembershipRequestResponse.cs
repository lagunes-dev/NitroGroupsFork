using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Shared.Contracts.Groups.Responses
{
    /// <summary>
    /// Una invitación o una solicitud para unirse. No incluye emails: el nombre del otro lado
    /// se resuelve con el resumen sin email del módulo Users.
    /// </summary>
    public class GroupMembershipRequestResponse
    {
        public long Id { get; set; }
        public long GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;
        public string GroupSlug { get; set; } = string.Empty;

        /// <summary>El músico invitado o que pidió unirse.</summary>
        public long MusicianUserId { get; set; }
        public string MusicianName { get; set; } = string.Empty;

        /// <summary>Quién la inició: un manager del grupo (invitación) o el músico (solicitud).</summary>
        public long InitiatedByUserId { get; set; }
        public MembershipDirection Direction { get; set; }
        public MembershipRequestStatus Status { get; set; }
        public string? Message { get; set; }
        public long? ResolvedByUserId { get; set; }
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Cuándo se resolvió (se mueve al aceptar, rechazar o cancelar); null mientras está pendiente.
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// El nombre del otro lado, según quién consulta: para el grupo es el músico; para el
        /// músico es el grupo.
        /// </summary>
        public string CounterpartName { get; set; } = string.Empty;
    }
}
