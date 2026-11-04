namespace NitroGroups.Shared.Contracts.Groups.Requests
{
    /// <summary>Un músico pide unirse a un grupo (S1). Quien pide es siempre el usuario del token.</summary>
    public class RequestToJoinGroupRequest
    {
        /// <summary>Nota opcional para el grupo.</summary>
        public string? Message { get; set; }
    }
}
