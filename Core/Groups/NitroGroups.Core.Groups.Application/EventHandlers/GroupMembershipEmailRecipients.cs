using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Groups.Application.EventHandlers;

/// <summary>
/// Emails de las partes de una membresía, resueltos por los contratos de Groups y Users.
/// Las direcciones se usan solo para entregar: nunca se escriben en el cuerpo del mensaje.
/// </summary>
public sealed class GroupMembershipEmailRecipients(IGroupsModuleApi groups, IUsersModuleApi users)
{
    /// <summary>Email del músico, o vacío si no hay.</summary>
    public async Task<IReadOnlyList<string>> MusicianAsync(long musicianUserId, CancellationToken cancellationToken)
    {
        var musician = await users.GetUserAsync(musicianUserId, cancellationToken);
        return string.IsNullOrWhiteSpace(musician?.Email) ? [] : [musician.Email.Trim()];
    }

    /// <summary>Emails de los Owner/Manager activos del grupo (sin repetir ni vacíos).</summary>
    public async Task<IReadOnlyList<string>> GroupManagersAsync(long groupId, CancellationToken cancellationToken)
    {
        var managerIds = await groups.GetManagerUserIdsAsync(groupId, cancellationToken);
        if (managerIds.Count == 0)
            return [];

        var managers = await users.GetUsersAsync(managerIds, cancellationToken);
        return managers.Values
            .Select(u => u.Email?.Trim())
            .Where(e => !string.IsNullOrEmpty(e))
            .Select(e => e!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>Nombre del músico para el asunto, sin exponer su email.</summary>
    public async Task<string> MusicianNameAsync(long musicianUserId, CancellationToken cancellationToken)
    {
        var musician = await users.GetUserAsync(musicianUserId, cancellationToken);
        var name = musician?.FullName;
        return string.IsNullOrWhiteSpace(name) ? "Un músico" : name;
    }

    public async Task<string> GroupNameAsync(long groupId, CancellationToken cancellationToken)
        => (await groups.GetGroupAsync(groupId, cancellationToken))?.GroupName ?? "El grupo";
}
