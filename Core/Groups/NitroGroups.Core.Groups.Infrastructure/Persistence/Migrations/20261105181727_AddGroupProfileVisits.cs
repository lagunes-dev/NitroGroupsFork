using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NitroGroups.Core.Groups.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupProfileVisits : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "group_profile_visits",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    group_id = table.Column<long>(type: "bigint", nullable: false),
                    musician_user_id = table.Column<long>(type: "bigint", nullable: false),
                    last_visited_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<long>(type: "bigint", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_group_profile_visits", x => x.id);
                    table.ForeignKey(
                        name: "FK_group_profile_visits_music_groups_group_id",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "music_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_group_profile_visits_group_id_musician_user_id",
                schema: "groups",
                table: "group_profile_visits",
                columns: new[] { "group_id", "musician_user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_group_profile_visits_musician_user_id_last_visited_at",
                schema: "groups",
                table: "group_profile_visits",
                columns: new[] { "musician_user_id", "last_visited_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "group_profile_visits",
                schema: "groups");
        }
    }
}
