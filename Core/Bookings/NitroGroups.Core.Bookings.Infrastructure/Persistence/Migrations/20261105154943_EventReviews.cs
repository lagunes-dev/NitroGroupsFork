using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EventReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "event_reviews",
                schema: "bookings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    event_request_id = table.Column<long>(type: "bigint", nullable: false),
                    client_user_id = table.Column<long>(type: "bigint", nullable: false),
                    group_id = table.Column<long>(type: "bigint", nullable: false),
                    rating = table.Column<short>(type: "smallint", nullable: false),
                    comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<long>(type: "bigint", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_reviews", x => x.id);
                    table.CheckConstraint("ck_event_reviews_rating_range", "rating between 1 and 5");
                    table.ForeignKey(
                        name: "FK_event_reviews_event_requests_event_request_id",
                        column: x => x.event_request_id,
                        principalSchema: "bookings",
                        principalTable: "event_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_event_reviews_event_request_id",
                schema: "bookings",
                table: "event_reviews",
                column: "event_request_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_event_reviews_group_id",
                schema: "bookings",
                table: "event_reviews",
                column: "group_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_reviews",
                schema: "bookings");
        }
    }
}
