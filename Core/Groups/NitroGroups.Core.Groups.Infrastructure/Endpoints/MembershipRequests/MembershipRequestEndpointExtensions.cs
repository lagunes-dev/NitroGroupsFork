using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using NitroGroups.Core.Groups.Application;
using NitroGroups.Shared.Abstractions.Services;

namespace NitroGroups.Core.Groups.Infrastructure.Endpoints.MembershipRequests;

internal static class MembershipRequestEndpointExtensions
{
    public const string Tag = "MembershipRequests";

    private const string NotSyncedMessage = "Usuario no registrado. Llama a POST /api/auth/sync primero.";

    /// <summary>401 si el usuario del token todavía no tiene id interno. Corre antes de validar el body.</summary>
    public static TBuilder RequireSyncedUser<TBuilder>(this TBuilder builder)
        where TBuilder : IEndpointConventionBuilder
        => builder.AddEndpointFilter(async (context, next) =>
        {
            var currentUser = context.HttpContext.RequestServices.GetRequiredService<ICurrentUserService>();
            if (currentUser.GetUserId() is null)
                return Results.Problem(NotSyncedMessage, statusCode: StatusCodes.Status401Unauthorized);

            return await next(context);
        });

    /// <summary>Traduce el resultado del caso de uso a una respuesta HTTP con ProblemDetails en español.</summary>
    public static IResult ToHttp<T>(this GroupsResult<T> result, Func<T, IResult> onSuccess)
    {
        if (result.IsSuccess)
            return onSuccess(result.Value!);

        var status = result.ErrorKind switch
        {
            GroupsErrorKind.Validation => StatusCodes.Status400BadRequest,
            GroupsErrorKind.Unauthorized => StatusCodes.Status401Unauthorized,
            GroupsErrorKind.Forbidden => StatusCodes.Status403Forbidden,
            GroupsErrorKind.NotFound => StatusCodes.Status404NotFound,
            GroupsErrorKind.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status500InternalServerError
        };

        return Results.Problem(result.Error, statusCode: status);
    }
}
