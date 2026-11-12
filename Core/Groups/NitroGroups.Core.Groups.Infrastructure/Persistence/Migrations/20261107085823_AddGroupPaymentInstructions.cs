using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NitroGroups.Core.Groups.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupPaymentInstructions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "payment_instructions",
                schema: "groups",
                table: "music_groups",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "payment_instructions_updated_at",
                schema: "groups",
                table: "music_groups",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "payment_instructions",
                schema: "groups",
                table: "music_groups");

            migrationBuilder.DropColumn(
                name: "payment_instructions_updated_at",
                schema: "groups",
                table: "music_groups");
        }
    }
}
