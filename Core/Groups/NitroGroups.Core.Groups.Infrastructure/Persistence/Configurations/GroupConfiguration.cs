using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using NitroGroups.Core.Groups.Domain.Entities;

namespace NitroGroups.Core.Groups.Infrastructure.Persistence.Configurations;

public class GroupConfiguration : IEntityTypeConfiguration<Group>
{
    public void Configure(EntityTypeBuilder<Group> builder)
    {
        builder.ToTable("music_groups");

        builder.HasKey(g => g.Id);

        builder.Property(g => g.Id).HasColumnName("id");

        builder.Property(g => g.OwnerUserId).HasColumnName("owner_user_id");
        builder.Property(g => g.Slug).IsRequired().HasMaxLength(120).HasColumnName("slug");
        builder.Property(g => g.GroupName).IsRequired().HasMaxLength(150).HasColumnName("group_name");
        builder.Property(g => g.Description).HasColumnType("text").HasColumnName("description");
        builder.Property(g => g.Biography).HasColumnType("text").HasColumnName("biography");
        builder.Property(g => g.NumMembers).HasDefaultValue(1).HasColumnName("num_members");
        builder.Property(g => g.YearsExperience).HasDefaultValue(0).HasColumnName("years_experience");
        builder.Property(g => g.Phone).HasMaxLength(20).HasColumnName("phone");
        builder.Property(g => g.Email).HasMaxLength(150).HasColumnName("email");
        builder.Property(g => g.LocationText).HasMaxLength(200).HasColumnName("location_text");
        builder.Property(g => g.ServiceRadiusKm).HasDefaultValue(50).HasColumnName("service_radius_km");
        builder.Property(g => g.Currency).HasMaxLength(3).HasDefaultValue("MXN").HasColumnName("currency");
        builder.Property(g => g.BasePrice).HasColumnType("decimal(12,2)").HasColumnName("base_price");
        builder.Property(g => g.HourlyRate).HasColumnType("decimal(12,2)").HasColumnName("hourly_rate");
        builder.Property(g => g.MinimumDurationHours).HasDefaultValue(2).HasColumnName("minimum_duration_hours");
        builder.Property(g => g.SetupTimeMinutes).HasDefaultValue(30).HasColumnName("setup_time_minutes");
        builder.Property(g => g.AverageRating).HasColumnType("decimal(3,2)").HasDefaultValue(0).HasColumnName("average_rating");
        builder.Property(g => g.TotalReviews).HasDefaultValue(0).HasColumnName("total_reviews");
        builder.Property(g => g.ViewCount).HasDefaultValue(0).HasColumnName("view_count");
        builder.Property(g => g.BookingCount).HasDefaultValue(0).HasColumnName("booking_count");
        builder.Property(g => g.IsVerified).HasDefaultValue(false).HasColumnName("is_verified");
        builder.Property(g => g.IsFeatured).HasDefaultValue(false).HasColumnName("is_featured");
        builder.Property(g => g.IsAcceptingBookings).HasDefaultValue(true).HasColumnName("is_accepting_bookings");
        builder.Property(g => g.CreatedAt).HasDefaultValueSql("now()").HasColumnName("created_at");
        builder.Property(g => g.CreatedBy).HasColumnName("created_by");
        builder.Property(g => g.DeletedAt).HasColumnName("deleted_at");
        builder.Property(g => g.DeletedBy).HasColumnName("deleted_by");
        builder.Property(g => g.UpdatedAt).HasColumnName("updated_at");
        builder.Property(g => g.UpdatedBy).HasColumnName("updated_by");
        builder.Property(g => g.Active).HasDefaultValue(true).HasColumnName("active");
        builder.Property(g => g.ProfilePictureUrl).HasMaxLength(500).HasColumnName("profile_picture_url");
        builder.Property(g => g.CoverImageUrl).HasMaxLength(500).HasColumnName("cover_image_url");
        // Ronda 9: cómo quiere el grupo que se le pague. Texto libre, tope de 500; null cuando no lo cargó.
        builder.Property(g => g.PaymentInstructions).HasMaxLength(500).HasColumnName("payment_instructions");
        builder.Property(g => g.PaymentInstructionsUpdatedAt).HasColumnName("payment_instructions_updated_at");

        builder.HasMany(g => g.Members)
            .WithOne(m => m.Group)
            .HasForeignKey(m => m.GroupId);

        builder.HasMany(g => g.Genres)
            .WithOne(gg => gg.Group)
            .HasForeignKey(gg => gg.GroupId);

        builder.HasMany(g => g.Media)
            .WithOne(m => m.Group)
            .HasForeignKey(m => m.GroupId);

        builder.HasIndex(g => g.Slug).IsUnique();
        builder.HasIndex(g => g.OwnerUserId);
        builder.HasIndex(g => new { g.IsFeatured, g.AverageRating });
        builder.HasIndex(g => new { g.IsAcceptingBookings, g.AverageRating });
    }
}