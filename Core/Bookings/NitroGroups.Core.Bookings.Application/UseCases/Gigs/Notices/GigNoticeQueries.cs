using Cortex.Mediator.Queries;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.Notices;

/// <summary>
/// S12: el manager ve en su agenda los avisos que recibió el grupo, del más reciente al más
/// antiguo, con el nombre del músico. El endpoint exige RequireGroupManager sobre este groupId.
/// </summary>
public sealed record GetGroupGigNoticesQuery(long GroupId) : IQuery<List<GigNoticeResponse>>;

public sealed class GetGroupGigNoticesQueryHandler(IUnitOfWorkBookings unitOfWork, IUsersModuleApi users)
    : IQueryHandler<GetGroupGigNoticesQuery, List<GigNoticeResponse>>
{
    public async Task<List<GigNoticeResponse>> Handle(GetGroupGigNoticesQuery query, CancellationToken cancellationToken)
    {
        var rows = await unitOfWork.GigNotices.ListByGroupAsync(query.GroupId, cancellationToken);
        if (rows.Count == 0)
            return [];

        var userMap = await users.GetUsersAsync(rows.Select(row => row.UserId).Distinct(), cancellationToken);
        return rows.Select(row => GigNoticeResponses.Build(row, userMap)).ToList();
    }
}

/// <summary>
/// S12, lado del músico: los avisos que el llamante mandó hoy. La agenda los usa para decir "ya lo
/// avisaste hoy" en vez de ofrecer el botón otra vez después de recargar la página.
/// </summary>
public sealed record GetMyGigNoticesTodayQuery(long UserId) : IQuery<List<GigNoticeResponse>>;

public sealed class GetMyGigNoticesTodayQueryHandler(IUnitOfWorkBookings unitOfWork, TimeProvider time)
    : IQueryHandler<GetMyGigNoticesTodayQuery, List<GigNoticeResponse>>
{
    public async Task<List<GigNoticeResponse>> Handle(GetMyGigNoticesTodayQuery query, CancellationToken cancellationToken)
    {
        var rows = await unitOfWork.GigNotices.ListByUserAndDayAsync(query.UserId, MexicoTime.Today(time), cancellationToken);
        if (rows.Count == 0)
            return [];

        // El músico es siempre el llamante: no se consulta a Users por el nombre de nadie más.
        return rows.Select(row => GigNoticeResponses.Build(row, new Dictionary<long, UserSummary>())).ToList();
    }
}

/// <summary>Arma la respuesta del aviso. El nombre sale de Users; el email nunca.</summary>
public static class GigNoticeResponses
{
    public static GigNoticeResponse Build(GigNotice notice, IReadOnlyDictionary<long, UserSummary> users)
        => new()
        {
            Id = notice.Id,
            GigId = notice.EventRequestId,
            UserId = notice.UserId,
            FullName = users.GetValueOrDefault(notice.UserId)?.FullName ?? string.Empty,
            Kind = notice.Kind.ToString(),
            SentOn = notice.SentOn
        };
}
