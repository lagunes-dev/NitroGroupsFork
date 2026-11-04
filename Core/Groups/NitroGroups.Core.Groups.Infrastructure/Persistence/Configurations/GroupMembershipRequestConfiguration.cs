using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Domain.DomainEvents.Groups.Enums;

namespace NitroGroups.Core.Groups.Infrastructure.Persistence.Configurations;

public class GroupMembershipRequestConfiguration : IEntityTypeConfiguration<GroupMembershipRequest>
{
    public void Configure(EntityTypeBuilder<GroupMembershipRequest> builder)
    {
        builder.ToTable("group_membership_requests");

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.GroupId).HasColumnName("group_id").IsRequired();
        builder.Property(r => r.MusicianUserId).HasColumnName("musician_user_id").IsRequired();
        builder.Property(r => r.InitiatedByUserId).HasColumnName("initiated_by_user_id").IsRequired();

        // Stored as integers (see MembershipDirection and MembershipRequestStatus: do not reorder).
        builder.Property(r => r.Direction).HasColumnName("direction").HasConversion<int>().IsRequired();
        builder.Property(r => r.Status).HasColumnName("status").HasConversion<int>().IsRequired();

        builder.Property(r => r.ResolvedByUserId).HasColumnName("resolved_by_user_id");
        builder.Property(r => r.Message).HasColumnName("message").HasMaxLength(GroupMembershipRequest.MaxMessageLength);

        // xmin: PostgreSQL native concurrency token (not a new column).
        builder.Property(r => r.Version).IsRowVersion();

        builder.Property(r => r.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(r => r.CreatedBy).HasColumnName("created_by");
        builder.Property(r => r.DeletedAt).HasColumnName("deleted_at");
        builder.Property(r => r.DeletedBy).HasColumnName("deleted_by");
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at");
        builder.Property(r => r.UpdatedBy).HasColumnName("updated_by");

        builder.HasOne(r => r.Group)
            .WithMany()
            .HasForeignKey(r => r.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        // Only one pending request per (group, musician), whichever side started it.
        builder.HasIndex(r => new { r.GroupId, r.MusicianUserId })
            .IsUnique()
            .HasFilter($"status = {(int)MembershipRequestStatus.Pending}");
        builder.HasIndex(r => new { r.GroupId, r.Status });
        builder.HasIndex(r => new { r.MusicianUserId, r.Status });
    }
}
