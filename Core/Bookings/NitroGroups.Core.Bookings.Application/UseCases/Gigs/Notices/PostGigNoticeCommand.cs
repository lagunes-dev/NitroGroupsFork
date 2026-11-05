using Cortex.Mediator.Commands;
using NitroGroups.Core.Bookings.Application.Abstractions;
using NitroGroups.Core.Bookings.Application.UseCases.Gigs.Details;
using NitroGroups.Core.Bookings.Domain.Entities;
using NitroGroups.Shared.Contracts.Bookings.Requests;
using NitroGroups.Shared.Contracts.Bookings.Responses;
using NitroGroups.Shared.Contracts.Modules;
using NitroGroups.Shared.Domain.DomainEvents.Bookings.Enums;

namespace NitroGroups.Core.Bookings.Application.UseCases.Gigs.Notices;

/// <param name="GroupId">El grupo de la ruta; el handler verifica que el toque sea suyo.</param>
public sealed record PostGigNoticeCommand(long GroupId, long GigId, long? CallerUserId, PostGigNoticeBody Body)
    : ICommand<BookingResult<GigNoticeResponse>>;

/// <summary>
/// S12: el músico avisa que al toque le falta la llegada, el pago o el setlist. El cuerpo lleva el
/// tipo y nada más. Se guarda uno por (toque, músico, tipo) y día: apretar dos veces responde lo
/// mismo que la primera vez en vez de error, y el manager no recibe ruido.
/// </summary>
public sealed class PostGigNoticeCommandHandler(
    IUnitOfWorkBookings unitOfWork,
    IGroupsModuleApi groups,
    IUsersModuleApi users,
    IGigNoticeRepository notices,
    TimeProvider time) : ICommandHandler<PostGigNoticeCommand, BookingResult<GigNoticeResponse>>
{
    internal const string InvalidKindMessage = "El aviso tiene que ser de llegada, pago o setlist.";
    internal const string NotFoundMessage = UpdateGigDetailsCommandHandler.NotFoundMessage;
    internal const string NotMemberMessage = "Solo un miembro activo del grupo puede avisar del toque.";
    internal const string NotAcceptedMessage = "Solo se puede avisar de un toque aceptado.";

    public async Task<BookingResult<GigNoticeResponse>> Handle(PostGigNoticeCommand command, CancellationToken cancellationToken)
    {
        if (!GigNoticeKinds.TryParse(command.Body.Kind, out var kind))
            return Failure(BookingErrorKind.Validation, InvalidKindMessage);

        if (command.CallerUserId is not { } callerUserId)
            return Failure(BookingErrorKind.Unauthorized, "Usuario no registrado.");

        var gig = await unitOfWork.EventRequests.GetByIdAsync(command.GigId);
        if (gig is null || gig.GroupId != command.GroupId)
            return Failure(BookingErrorKind.NotFound, NotFoundMessage);

        // Se lee de Groups, nunca de su esquema: una membresía dada de baja no aparece en esta lista.
        var activeMembers = await groups.GetActiveMemberUserIdsAsync(command.GroupId, cancellationToken);
        if (!activeMembers.Contains(callerUserId))
            return Failure(BookingErrorKind.Forbidden, NotMemberMessage);

        if (gig.Status != EventRequestStatus.Accepted)
            return Failure(BookingErrorKind.Conflict, NotAcceptedMessage);

        var sentOn = MexicoTime.Today(time);
        var existing = await notices.FindByDayAsync(gig.Id, callerUserId, kind, sentOn, cancellationToken);
        var userMap = await users.GetUsersAsync([callerUserId], cancellationToken);
        if (existing is not null)
            return BookingResult<GigNoticeResponse>.Success(GigNoticeResponses.Build(existing, userMap));

        var notice = new GigNotice
        {
            EventRequestId = gig.Id,
            UserId = callerUserId,
            Kind = kind,
            SentOn = sentOn,
            CreatedBy = callerUserId
        };

        await notices.CreateAsync(notice);
        await unitOfWork.CompleteAsync();

        return BookingResult<GigNoticeResponse>.Success(GigNoticeResponses.Build(notice, userMap));
    }

    private static BookingResult<GigNoticeResponse> Failure(BookingErrorKind kind, string message)
        => BookingResult<GigNoticeResponse>.Failure(kind, message);
}
