using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Bookings.Domain.Entities;

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Configurations;

public class EventReviewConfiguration : IEntityTypeConfiguration<EventReview>
{
    public void Configure(EntityTypeBuilder<EventReview> builder)
    {
        builder.ToTable("event_reviews", table => table.HasCheckConstraint(
            "ck_event_reviews_rating_range",
            $"rating between {EventReview.MinRating} and {EventReview.MaxRating}"));

        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).HasColumnName("id");
        builder.Property(r => r.EventRequestId).HasColumnName("event_request_id").IsRequired();
        builder.Property(r => r.ClientUserId).HasColumnName("client_user_id").IsRequired();
        builder.Property(r => r.GroupId).HasColumnName("group_id").IsRequired();
        builder.Property(r => r.Rating).HasColumnType("smallint").HasColumnName("rating").IsRequired();
        builder.Property(r => r.Comment)
            .HasMaxLength(EventReview.MaxCommentLength)
            .HasColumnName("comment");

        builder.Property(r => r.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(r => r.CreatedBy).HasColumnName("created_by");
        builder.Property(r => r.DeletedAt).HasColumnName("deleted_at");
        builder.Property(r => r.DeletedBy).HasColumnName("deleted_by");
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at");
        builder.Property(r => r.UpdatedBy).HasColumnName("updated_by");

        builder.HasOne<EventRequest>()
            .WithMany()
            .HasForeignKey(r => r.EventRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        // Una sola reseña por evento: el endpoint responde 409 y la base también lo rechaza.
        builder.HasIndex(r => r.EventRequestId).IsUnique();

        // El listado público filtra por grupo y ordena por fecha (la más reciente primero).
        builder.HasIndex(r => r.GroupId);
    }
}
