using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Bookings.Domain.Entities;

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Configurations;

public class GigAttendanceConfiguration : IEntityTypeConfiguration<GigAttendance>
{
    public void Configure(EntityTypeBuilder<GigAttendance> builder)
    {
        builder.ToTable("gig_attendance");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).HasColumnName("id");
        builder.Property(a => a.EventRequestId).HasColumnName("event_request_id").IsRequired();
        builder.Property(a => a.UserId).HasColumnName("user_id").IsRequired();

        // Se guarda como entero (ver GigAttendanceStatus: no reordenar).
        builder.Property(a => a.Status).HasColumnName("status").HasConversion<int>().IsRequired();

        builder.Property(a => a.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(a => a.CreatedBy).HasColumnName("created_by");
        builder.Property(a => a.DeletedAt).HasColumnName("deleted_at");
        builder.Property(a => a.DeletedBy).HasColumnName("deleted_by");
        builder.Property(a => a.UpdatedAt).HasColumnName("updated_at");
        builder.Property(a => a.UpdatedBy).HasColumnName("updated_by");

        // Una persona responde una sola vez por toque: el upsert actualiza esta fila.
        builder.HasIndex(a => new { a.EventRequestId, a.UserId }).IsUnique();
    }
}
