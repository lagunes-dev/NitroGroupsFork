using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Bookings.Domain.Entities;

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Configurations;

public class GigPayConfiguration : IEntityTypeConfiguration<GigPay>
{
    public void Configure(EntityTypeBuilder<GigPay> builder)
    {
        builder.ToTable("gig_pay", table => table.HasCheckConstraint("ck_gig_pay_amount_non_negative", "amount >= 0"));

        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id");
        builder.Property(p => p.EventRequestId).HasColumnName("event_request_id").IsRequired();
        builder.Property(p => p.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(p => p.Amount).HasColumnName("amount").HasPrecision(12, 2).IsRequired();

        builder.Property(p => p.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(p => p.CreatedBy).HasColumnName("created_by");
        builder.Property(p => p.DeletedAt).HasColumnName("deleted_at");
        builder.Property(p => p.DeletedBy).HasColumnName("deleted_by");
        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at");
        builder.Property(p => p.UpdatedBy).HasColumnName("updated_by");

        builder.HasOne<EventRequest>()
            .WithMany()
            .HasForeignKey(p => p.EventRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        // Un solo pago por músico y toque: reemplazar el conjunto actualiza o revive esta fila.
        builder.HasIndex(p => new { p.EventRequestId, p.UserId }).IsUnique();
    }
}
