using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Core.Groups.Infrastructure.Adapters;
using NitroGroups.Core.Groups.Infrastructure.Persistence;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;
using NitroGroups.Tests.Integration.Infrastructure;

namespace NitroGroups.Tests.Integration.Bookings;

/// <summary>
/// T59 (S22): el teléfono del manager viaja al miembro activo por el contrato de Groups
/// (<c>GroupSummary.Phone</c>), que lo llena el adaptador desde <c>Group.Phone</c>. Un teléfono
/// vacío o solo con espacios no es un dato: el contrato dice null y el front no dibuja una
/// etiqueta vacía. Vive aquí, junto a la agenda, porque el único consumidor del dato es el toque.
/// </summary>
public class GroupsModuleApiPhoneIntegrationTests(IntegrationTestFixture fixture) : IClassFixture<IntegrationTestFixture>
{
    private const long OwnerId = 10;

    [Theory]
    [InlineData("33 1234 5678", "33 1234 5678")]
    [InlineData(" 33 1234 5678 ", "33 1234 5678")]
    [InlineData("", null)]
    [InlineData("   ", null)]
    public async Task GetGroupAsync_ElTelefonoDelGrupo_LlegaSinEspaciosYNuncaVacio(string stored, string? expected)
    {
        await using var context = fixture.CreateGroupsContext();
        var groupId = await SeedGroupAsync(context, stored);

        var summary = await new GroupsModuleApi(context).GetGroupAsync(groupId);

        Assert.NotNull(summary);
        Assert.Equal(expected, summary!.Phone);
    }

    [Fact]
    public async Task GetGroupsAsync_LlevaElMismoTelefonoQueLaConsultaIndividual()
    {
        await using var context = fixture.CreateGroupsContext();
        var conTelefono = await SeedGroupAsync(context, "33 1234 5678");
        var sinTelefono = await SeedGroupAsync(context, string.Empty);

        var groups = await new GroupsModuleApi(context).GetGroupsAsync([conTelefono, sinTelefono]);

        Assert.Equal("33 1234 5678", groups[conTelefono].Phone);
        Assert.Null(groups[sinTelefono].Phone);
    }

    // T59 (S22): el rol que la tarjeta del toque muestra es el del grupo, y sale de este contrato:
    // Bookings nunca lee `groups.group_members`.
    [Fact]
    public async Task GetActiveMemberRolesAsync_DevuelveElRolDelGrupo_SoloDeLosMiembrosActivos()
    {
        await using var context = fixture.CreateGroupsContext();
        var groupId = await SeedGroupAsync(context, string.Empty);
        await AddMemberAsync(context, groupId, OwnerId, GroupMemberRole.Manager, active: true);
        await AddMemberAsync(context, groupId, 11, GroupMemberRole.Member, active: true);
        await AddMemberAsync(context, groupId, 12, GroupMemberRole.Member, active: false);

        var roles = await new GroupsModuleApi(context).GetActiveMemberRolesAsync(groupId, [OwnerId, 11, 12, 13]);

        Assert.Equal("Manager", roles[OwnerId]);
        Assert.Equal("Member", roles[11]);
        // Una membresía dada de baja no es rol, y un id ajeno al grupo no aparece.
        Assert.False(roles.ContainsKey(12));
        Assert.False(roles.ContainsKey(13));
    }

    [Fact]
    public async Task GetActiveMemberRolesAsync_AlDuenoSinFilaDeMembresia_LePoneOwner()
    {
        await using var context = fixture.CreateGroupsContext();
        var groupId = await SeedGroupAsync(context, string.Empty);

        var roles = await new GroupsModuleApi(context).GetActiveMemberRolesAsync(groupId, [OwnerId]);

        Assert.Equal("Owner", roles[OwnerId]);
    }

    [Fact]
    public async Task GetActiveMemberRolesAsync_SinUsuarios_NoConsultaNada()
    {
        await using var context = fixture.CreateGroupsContext();
        var groupId = await SeedGroupAsync(context, string.Empty);

        Assert.Empty(await new GroupsModuleApi(context).GetActiveMemberRolesAsync(groupId, []));
    }

    private static async Task AddMemberAsync(GroupsDbContext context, long groupId, long userId, GroupMemberRole role, bool active)
    {
        context.GroupMembers.Add(new GroupMember
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            IsActive = active,
            JoinedAt = DateTime.UtcNow.AddDays(-30),
            LeftAt = active ? null : DateTime.UtcNow.AddDays(-1),
            JoinedVia = JoinedVia.Manual
        });
        await context.SaveChangesAsync();
    }

    private static async Task<long> SeedGroupAsync(GroupsDbContext context, string phone)
    {
        var group = new Group
        {
            OwnerUserId = OwnerId,
            Slug = $"los-test-{Guid.NewGuid():N}",
            GroupName = "Los Test",
            Email = "grupo@test.mx",
            Phone = phone,
            Active = true
        };
        context.Groups.Add(group);
        await context.SaveChangesAsync();
        return group.Id;
    }
}
