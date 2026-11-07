using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Application.UseCases.EventRequests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.Reviews;

/// <summary>Reseñas públicas de un grupo (la página es la que se pide, ya acotada).</summary>
public sealed record GetGroupReviewsQuery(long GroupId, int Page = 1, int Size = 10) : IQuery<GroupReviewsResponse>;

public sealed class GetGroupReviewsQueryHandler(IUnitOfWorkBookings unitOfWork, IUsersModuleApi users)
    : IQueryHandler<GetGroupReviewsQuery, GroupReviewsResponse>
{
    public const int MaxPageSize = 48;

    public async Task<GroupReviewsResponse> Handle(GetGroupReviewsQuery query, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, query.Page);
        var size = Math.Clamp(query.Size, 1, MaxPageSize);

        var reviews = await unitOfWork.EventReviews.ListByGroupAsync(query.GroupId, page, size, cancellationToken);
        var summary = await unitOfWork.EventReviews.SummarizeAsync(query.GroupId, cancellationToken);
        var authors = await users.GetUsersAsync(
            reviews.Items.Select(row => row.ClientUserId).Distinct(), cancellationToken);

        return new GroupReviewsResponse
        {
            Summary = new GroupReviewSummaryResponse { Average = summary.Average, Count = summary.Count },
            Items = reviews.Items.Select(row => new GroupReviewItemResponse
            {
                Rating = row.Rating,
                Comment = row.Comment,
                CreatedAt = row.CreatedAt,
                EventType = row.EventType,
                AuthorName = EventRequestResponses.ShortName(authors.GetValueOrDefault(row.ClientUserId))
            }).ToList(),
            TotalCount = reviews.TotalCount,
            PageNumber = reviews.PageNumber,
            PageSize = reviews.PageSize,
            HasNextPage = reviews.HasNextPage,
            HasPreviousPage = reviews.HasPreviousPage
        };
    }
}
