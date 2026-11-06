using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Bookings.Domain.Entities;

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Configurations;

public class EventRequestConfiguration : IEntityTypeConfiguration<EventRequest>
{
    public void Configure(EntityTypeBuilder<EventRequest> builder)
    {
        builder.ToTable("event_requests");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id");
        builder.Property(e => e.GroupId).HasColumnName("group_id").IsRequired();
        builder.Property(e => e.ClientUserId).HasColumnName("client_user_id").IsRequired();
        builder.Property(e => e.EventDate).HasColumnName("event_date").IsRequired();
        builder.Property(e => e.StartTime).HasColumnName("start_time");
        builder.Property(e => e.DurationHours).HasColumnName("duration_hours").IsRequired();
        builder.Property(e => e.EventType).HasColumnName("event_type").HasMaxLength(50).IsRequired();
        builder.Property(e => e.LocationText).HasColumnName("location_text").HasMaxLength(300).IsRequired();
        builder.Property(e => e.GuestCount).HasColumnName("guest_count");
        builder.Property(e => e.Budget).HasColumnName("budget").HasPrecision(12, 2);
        builder.Property(e => e.Currency).HasColumnName("currency").HasMaxLength(3).HasDefaultValue("MXN").IsRequired();
        builder.Property(e => e.Message).HasColumnName("message").HasColumnType("text").IsRequired();

        // Se guarda como entero (ver EventRequestStatus: no reordenar).
        builder.Property(e => e.Status).HasColumnName("status").HasConversion<int>().IsRequired();

        builder.Property(e => e.IsSelfBooked).HasColumnName("is_self_booked").HasDefaultValue(false);

        // xmin: token de concurrencia nativo de PostgreSQL (no es una columna nueva).
        builder.Property(e => e.Version).IsRowVersion();
        builder.Property(e => e.RespondedAt).HasColumnName("responded_at");
        builder.Property(e => e.ResponseMessage).HasColumnName("response_message").HasColumnType("text");

        builder.Property(e => e.Setlist).HasColumnName("setlist").HasMaxLength(4000);
        builder.Property(e => e.CallTime).HasColumnName("call_time");
        builder.Property(e => e.DepositAmount).HasColumnName("deposit_amount").HasPrecision(12, 2);
        builder.Property(e => e.DepositReceivedAt).HasColumnName("deposit_received_at");
        builder.Property(e => e.BalanceReceivedAt).HasColumnName("balance_received_at");

        // S24: un día del calendario, igual que event_date, no un instante.
        builder.Property(e => e.DepositDueDate).HasColumnName("deposit_due_date");
        builder.Property(e => e.BalanceDueDate).HasColumnName("balance_due_date");

        builder.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(e => e.CreatedBy).HasColumnName("created_by");
        builder.Property(e => e.DeletedAt).HasColumnName("deleted_at");
        builder.Property(e => e.DeletedBy).HasColumnName("deleted_by");
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        builder.Property(e => e.UpdatedBy).HasColumnName("updated_by");

        builder.HasMany(e => e.Messages)
            .WithOne(m => m.EventRequest)
            .HasForeignKey(m => m.EventRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Attendance)
            .WithOne()
            .HasForeignKey(a => a.EventRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.GroupId, e.Status, e.CreatedAt });
        builder.HasIndex(e => new { e.ClientUserId, e.CreatedAt });
    }
}
