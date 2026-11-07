using Cortex.Mediator.Notifications;
using Microsoft.Extensions.Logging;
using NitroGroups.Core.Groups.Application.Abstractions;
using NitroGroups.Core.Groups.Application.Events;

namespace NitroGroups.Core.Groups.Application.EventHandlers
{
    /// <summary>
    /// L5: cuando Bookings publica una reseña, el perfil del grupo actualiza su promedio y su
    /// total de forma incremental (solo se crean reseñas, no se editan ni se borran).
    /// </summary>
    public class GroupReviewPostedEventHandler(
        IUnitOfWorkGroups unitOfWork,
        ILogger<GroupReviewPostedEventHandler> logger) : INotificationHandler<BookingsEvents.GroupReviewPostedEvent>
    {
        private readonly IUnitOfWorkGroups _unitOfWork = unitOfWork;
        private readonly ILogger<GroupReviewPostedEventHandler> _logger = logger;

        public async Task Handle(BookingsEvents.GroupReviewPostedEvent notification, CancellationToken cancellationToken)
        {
            var group = await _unitOfWork.Groups.GetByIdAsync(notification.GroupId);
            if (group is null)
            {
                _logger.LogWarning(
                    "Llegó una reseña de un grupo que no existe: {GroupId}", notification.GroupId);
                return;
            }

            // Solo se crean reseñas, así que el promedio se actualiza de forma incremental:
            // (promedio anterior * reseñas anteriores + nueva calificación) / reseñas nuevas.
            var total = group.TotalReviews + 1;
            var average = (group.AverageRating * group.TotalReviews + notification.Rating) / total;

            group.TotalReviews = total;
            group.AverageRating = Math.Round(average, 2, MidpointRounding.AwayFromZero);

            _unitOfWork.Groups.Update(group);
            await _unitOfWork.CompleteAsync();

            _logger.LogInformation(
                "Grupo {GroupId}: {TotalReviews} reseñas, promedio {AverageRating}",
                group.Id, group.TotalReviews, group.AverageRating);
        }
    }
}
