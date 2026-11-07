using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Groups.Domain.Entities;

namespace NitroGroups.Core.Groups.Infrastructure.Persistence.Configurations;

public class GroupProfileVisitConfiguration : IEntityTypeConfiguration<GroupProfileVisit>
{
    public void Configure(EntityTypeBuilder<GroupProfileVisit> builder)
    {
        builder.ToTable("group_profile_visits");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id).HasColumnName("id");
        builder.Property(v => v.GroupId).HasColumnName("group_id").IsRequired();
        builder.Property(v => v.MusicianUserId).HasColumnName("musician_user_id").IsRequired();
        builder.Property(v => v.LastVisitedAt).HasColumnName("last_visited_at").IsRequired();

        builder.Property(v => v.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(v => v.CreatedBy).HasColumnName("created_by");
        builder.Property(v => v.DeletedAt).HasColumnName("deleted_at");
        builder.Property(v => v.DeletedBy).HasColumnName("deleted_by");
        builder.Property(v => v.UpdatedAt).HasColumnName("updated_at");
        builder.Property(v => v.UpdatedBy).HasColumnName("updated_by");

        builder.HasOne(v => v.Group)
            .WithMany()
            .HasForeignKey(v => v.GroupId)
            .OnDelete(DeleteBehavior.Cascade);

        // One visit per group and musician: refreshing can only move the date.
        builder.HasIndex(v => new { v.GroupId, v.MusicianUserId }).IsUnique();

        // The musician's inbox reads every group that looked at him, newest first.
        builder.HasIndex(v => new { v.MusicianUserId, v.LastVisitedAt });
    }
}
