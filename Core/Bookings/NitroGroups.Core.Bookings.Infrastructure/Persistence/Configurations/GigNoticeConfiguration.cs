using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Bookings.Domain.Entities;

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Configurations;

public class GigNoticeConfiguration : IEntityTypeConfiguration<GigNotice>
{
    public void Configure(EntityTypeBuilder<GigNotice> builder)
    {
        builder.ToTable("gig_notices", table => table.HasCheckConstraint(
            "ck_gig_notices_kind_range",
            $"kind between {(int)GigNoticeKind.CallTime} and {(int)GigNoticeKind.CannotFindVenue}"));

        builder.HasKey(notice => notice.Id);
        builder.Property(notice => notice.Id).HasColumnName("id");
        builder.Property(notice => notice.EventRequestId).HasColumnName("event_request_id").IsRequired();
        builder.Property(notice => notice.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(notice => notice.Kind).HasColumnName("kind").IsRequired();
        builder.Property(notice => notice.SentOn).HasColumnType("date").HasColumnName("sent_on").IsRequired();

        builder.Property(notice => notice.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(notice => notice.CreatedBy).HasColumnName("created_by");
        builder.Property(notice => notice.DeletedAt).HasColumnName("deleted_at");
        builder.Property(notice => notice.DeletedBy).HasColumnName("deleted_by");
        builder.Property(notice => notice.UpdatedAt).HasColumnName("updated_at");
        builder.Property(notice => notice.UpdatedBy).HasColumnName("updated_by");

        builder.HasOne<EventRequest>()
            .WithMany()
            .HasForeignKey(notice => notice.EventRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        // Un solo aviso por músico, tipo y día: la segunda pulsación del mismo día no crea otra fila.
        builder.HasIndex(notice => new { notice.EventRequestId, notice.UserId, notice.Kind, notice.SentOn }).IsUnique();

        // El músico lee los suyos del día; el manager los del grupo.
        builder.HasIndex(notice => new { notice.UserId, notice.SentOn });
    }
}
