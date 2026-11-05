using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NitroGroups.Core.Users.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMusicianPublicProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "headline",
                schema: "users",
                table: "musicians",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "instruments",
                schema: "users",
                table: "musicians",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "video_url",
                schema: "users",
                table: "musicians",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "headline",
                schema: "users",
                table: "musicians");

            migrationBuilder.DropColumn(
                name: "instruments",
                schema: "users",
                table: "musicians");

            migrationBuilder.DropColumn(
                name: "video_url",
                schema: "users",
                table: "musicians");
        }
    }
}
