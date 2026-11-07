using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GigNoticeUnpaid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // S21: "Unpaid" (6), el aviso de que el toque ya fue y no le pagaron. Sin cambio de datos.
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices DROP CONSTRAINT ck_gig_notices_kind_range;");
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices ADD CONSTRAINT ck_gig_notices_kind_range CHECK (kind between 1 and 6);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // El aviso 6 no cabe en el CHECK anterior: se borra antes de estrecharlo.
            migrationBuilder.Sql("DELETE FROM bookings.gig_notices WHERE kind > 5;");
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices DROP CONSTRAINT ck_gig_notices_kind_range;");
            migrationBuilder.Sql("ALTER TABLE bookings.gig_notices ADD CONSTRAINT ck_gig_notices_kind_range CHECK (kind between 1 and 5);");
        }
    }
}
