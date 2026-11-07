namespace NitroGroups.Shared.Contracts.Groups.Responses;

/// <summary>
/// Lo que el músico ve en su panel cuando un grupo miró su perfil (S9): cuántos grupos fueron y
/// cuáles, para poder abrir su perfil público. Nunca lleva emails.
/// </summary>
public sealed class ProfileVisitsResponse
{
    /// <summary>Cuántos grupos miraron el perfil: uno por grupo, no uno por visita.</summary>
    public int Count { get; set; }

    /// <summary>Los grupos que miraron, el más reciente primero.</summary>
    public List<ProfileVisitGroupResponse> Groups { get; set; } = [];
}

/// <summary>Un grupo que miró el perfil del músico, con lo justo para enlazarlo.</summary>
public sealed class ProfileVisitGroupResponse
{
    public long Id { get; set; }

    public string GroupName { get; set; } = string.Empty;

    /// <summary>Slug del perfil público del grupo (<c>/groups/{slug}</c>).</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>Cuándo fue la última visita de este grupo.</summary>
    public DateTime LastVisitedAt { get; set; }
}
