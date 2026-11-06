using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GigNoticeLateAndVenue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // S17: "Late" (4) y "CannotFindVenue" (5). Sin cambio de datos: solo se ensancha el CHECK.
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices DROP CONSTRAINT ck_gig_notices_kind_range;");
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices ADD CONSTRAINT ck_gig_notices_kind_range CHECK (kind between 1 and 5);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Los avisos 4 y 5 no caben en el CHECK anterior: se borran antes de estrecharlo.
            migrationBuilder.Sql("DELETE FROM bookings.gig_notices WHERE kind > 3;");
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices DROP CONSTRAINT ck_gig_notices_kind_range;");
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices ADD CONSTRAINT ck_gig_notices_kind_range CHECK (kind between 1 and 3);");
        }
    }
}
