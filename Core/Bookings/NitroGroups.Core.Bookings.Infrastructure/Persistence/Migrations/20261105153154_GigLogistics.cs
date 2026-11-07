using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GigLogistics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "call_time",
                schema: "bookings",
                table: "event_requests",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "deposit_amount",
                schema: "bookings",
                table: "event_requests",
                type: "numeric(12,2)",
                precision: 12,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "deposit_received_at",
                schema: "bookings",
                table: "event_requests",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "setlist",
                schema: "bookings",
                table: "event_requests",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "gig_pay",
                schema: "bookings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    event_request_id = table.Column<long>(type: "bigint", nullable: false),
                    user_id = table.Column<long>(type: "bigint", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<long>(type: "bigint", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gig_pay", x => x.id);
                    table.CheckConstraint("ck_gig_pay_amount_non_negative", "amount >= 0");
                    table.ForeignKey(
                        name: "FK_gig_pay_event_requests_event_request_id",
                        column: x => x.event_request_id,
                        principalSchema: "bookings",
                        principalTable: "event_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gig_pay_event_request_id_user_id",
                schema: "bookings",
                table: "gig_pay",
                columns: new[] { "event_request_id", "user_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gig_pay",
                schema: "bookings");

            migrationBuilder.DropColumn(
                name: "call_time",
                schema: "bookings",
                table: "event_requests");

            migrationBuilder.DropColumn(
                name: "deposit_amount",
                schema: "bookings",
                table: "event_requests");

            migrationBuilder.DropColumn(
                name: "deposit_received_at",
                schema: "bookings",
                table: "event_requests");

            migrationBuilder.DropColumn(
                name: "setlist",
                schema: "bookings",
                table: "event_requests");
        }
    }
}
