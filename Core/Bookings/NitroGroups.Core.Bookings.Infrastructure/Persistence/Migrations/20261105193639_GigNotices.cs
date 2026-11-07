using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GigNotices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "gig_notices",
                schema: "bookings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    event_request_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    kind = table.Column<int>(type: "integer", nullable: false),
                    sent_on = table.Column<DateOnly>(type: "date", nullable: false),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<long>(type: "bigint", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gig_notices", x => x.id);
                    table.CheckConstraint("ck_gig_notices_kind_range", "kind between 1 and 3");
                    table.ForeignKey(
                        name: "FK_gig_notices_event_requests_event_request_id",
                        column: x => x.event_request_id,
                        principalSchema: "bookings",
                        principalTable: "event_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gig_notices_event_request_id_user_id_kind_sent_on",
                schema: "bookings",
                table: "gig_notices",
                columns: new[] { "event_request_id", "user_id", "kind", "sent_on" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_gig_notices_user_id_sent_on",
                schema: "bookings",
                table: "gig_notices",
                columns: new[] { "user_id", "sent_on" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gig_notices",
                schema: "bookings");
        }
    }
}
