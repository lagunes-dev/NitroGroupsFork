using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NitroGroups.Core.Bookings.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GigDueDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "balance_due_date",
                schema: "bookings",
                table: "event_requests",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "deposit_due_date",
                schema: "bookings",
                table: "event_requests",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "balance_due_date",
                schema: "bookings",
                table: "event_requests");

            migrationBuilder.DropColumn(
                name: "deposit_due_date",
                schema: "bookings",
                table: "event_requests");
        }
    }
}
