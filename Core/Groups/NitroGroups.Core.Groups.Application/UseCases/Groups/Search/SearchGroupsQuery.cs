using Cortex.Mediator.Queries;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Shared.Contracts;
using NitroGroups.Shared.Contracts.Groups.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Groups.Application.UseCases.Groups.Search
{
    public sealed record SearchGroupsQuery(
        string? Text,
        string? GenreSlug,
        string? City,
        decimal? MaxPrice,
        DateOnly? Date,
        int Page = 1,
        int Size = 12) : IQuery<PagedResult<GroupSearchItem>>;

    public sealed class SearchGroupsQueryHandler(IUnitOfWorkGroups unitOfWork, ISchedulesModuleApi schedules, IBookingsModuleApi bookings)
        : IQueryHandler<SearchGroupsQuery, PagedResult<GroupSearchItem>>
    {
        public const int MaxPageSize = 48;

        /// <summary>
        /// El día del evento se interpreta en hora de México (la plataforma opera en MXN).
        /// Si el host no trae tzdata (contenedores mínimos) se usa UTC-6, que es la hora del
        /// centro de México todo el año desde que se eliminó el horario de verano en 2022.
        /// </summary>
        private static readonly Lazy<TimeZoneInfo> EventTimeZone = new(() =>
            TimeZoneInfo.TryFindSystemTimeZoneById("America/Mexico_City", out var tz)
                ? tz
                : TimeZoneInfo.CreateCustomTimeZone("Mexico/Central", TimeSpan.FromHours(-6), "Mexico Central", "Mexico Central"));

        public async Task<PagedResult<GroupSearchItem>> Handle(SearchGroupsQuery query, CancellationToken cancellationToken)
        {
            var page = Math.Max(1, query.Page);
            var size = Math.Clamp(query.Size, 1, MaxPageSize);
            var filter = new GroupSearchFilter(
                Normalize(query.Text), Normalize(query.GenreSlug), Normalize(query.City), query.MaxPrice);

            IReadOnlySet<long> excluded = new HashSet<long>();
            if (query.Date is { } date)
            {
                // La disponibilidad vive en Schedules y los eventos aceptados en Bookings: se
                // consultan por contrato, solo para los candidatos. Una fecha con un evento ya
                // aceptado no se puede ofrecer como libre.
                var candidates = await unitOfWork.GroupSearch.GetMatchingIdsAsync(filter, cancellationToken);
                var (from, to) = LocalDay(date);
                var unavailable = await schedules.GetUnavailableGroupIdsAsync(candidates, from, to, cancellationToken);
                var booked = await bookings.GetBusyGroupIdsAsync(candidates, date, cancellationToken);
                excluded = unavailable.Union(booked).ToHashSet();
            }

            return await unitOfWork.GroupSearch.SearchAsync(filter, excluded, page, size, cancellationToken);
        }

        /// <summary>[00:00, 24:00) del día en hora de México, como instantes absolutos.</summary>
        public static (DateTimeOffset From, DateTimeOffset To) LocalDay(DateOnly date)
        {
            var start = date.ToDateTime(TimeOnly.MinValue);
            var end = date.AddDays(1).ToDateTime(TimeOnly.MinValue);
            return (new DateTimeOffset(start, EventTimeZone.Value.GetUtcOffset(start)),
                    new DateTimeOffset(end, EventTimeZone.Value.GetUtcOffset(end)));
        }

        private static string? Normalize(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim().ToLowerInvariant();
    }
}
