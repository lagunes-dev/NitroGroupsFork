using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace NitroGroups.Core.Groups.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupMembershipRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "group_membership_requests",
                schema: "groups",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    group_id = table.Column<long>(type: "bigint", nullable: false),
                    musician_user_id = table.Column<long>(type: "bigint", nullable: false),
                    initiated_by_user_id = table.Column<long>(type: "bigint", nullable: false),
                    direction = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    resolved_by_user_id = table.Column<long>(type: "bigint", nullable: true),
                    message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_by = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_by = table.Column<long>(type: "bigint", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    deleted_by = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_group_membership_requests", x => x.id);
                    table.ForeignKey(
                        name: "FK_group_membership_requests_music_groups_group_id",
                        column: x => x.group_id,
                        principalSchema: "groups",
                        principalTable: "music_groups",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_group_membership_requests_group_id_musician_user_id",
                schema: "groups",
                table: "group_membership_requests",
                columns: new[] { "group_id", "musician_user_id" },
                unique: true,
                filter: "status = 0");

            migrationBuilder.CreateIndex(
                name: "IX_group_membership_requests_group_id_status",
                schema: "groups",
                table: "group_membership_requests",
                columns: new[] { "group_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_group_membership_requests_musician_user_id_status",
                schema: "groups",
                table: "group_membership_requests",
                columns: new[] { "musician_user_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "group_membership_requests",
                schema: "groups");
        }
    }
}
