using AutoMapper;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Create;
using NitroGroups.Core.Groups.Application.UseCases.Groups.Update;
using NitroGroups.Core.Groups.Domain.Entities;
using NitroGroups.Shared.Contracts.Groups.Requests;
using NitroGroups.Shared.Contracts.Groups.Responses;

namespace NitroGroups.Core.Groups.Application.Mappings
{
    public class GroupProfile : Profile
    {
        public GroupProfile() 
        {
            CreateMap<UpdateGroupRequest, UpdateGroupCommand>()
            .ConstructUsing((src, ctx) => new UpdateGroupCommand(
                (long)ctx.Items["Id"],
                src.Slug,
                src.GroupName,
                src.Description,
                src.Biography,
                src.NumMembers,
                src.YearsExperience,
                src.Phone,
                src.Email,
                src.LocationText,
                src.ServiceRadiusKm,
                src.Currency,
                src.BasePrice,
                src.HourlyRate,
                src.MinimumDurationHours,
                src.SetupTimeMinutes,
                src.IsAcceptingBookings,
                src.ProfilePictureUrl,
                src.CoverImageUrl,
                src.PaymentInstructions));

            // Ronda 9: el texto de cómo pagar lo escribe la entidad (normaliza y fecha el cambio), no
            // el mapeo; si AutoMapper lo copiara, la fecha nunca se movería.
            CreateMap<UpdateGroupCommand, Group>()
                .ForMember(d => d.PaymentInstructions, o => o.Ignore())
                .ForMember(d => d.PaymentInstructionsUpdatedAt, o => o.Ignore());
            CreateMap<UpdateGroupCommand, GroupResponse>();
            
            // Create maps
            CreateMap<CreateGroupRequest, CreateGroupCommand>()
                .ConstructUsing(src => new CreateGroupCommand(
                    src.OwnerUserId,
                    src.Slug,
                    src.GroupName,
                    src.Description,
                    src.Biography,
                    src.NumMembers,
                    src.YearsExperience,
                    src.Phone,
                    src.Email,
                    src.LocationText,
                    src.ServiceRadiusKm,
                    src.Currency,
                    src.BasePrice,
                    src.HourlyRate,
                    src.MinimumDurationHours,
                    src.SetupTimeMinutes,
                    src.IsAcceptingBookings,
                    src.Active,
                    src.PaymentInstructions));

            CreateMap<CreateGroupCommand, Group>()
                .ForMember(d => d.PaymentInstructions, o => o.Ignore())
                .ForMember(d => d.PaymentInstructionsUpdatedAt, o => o.Ignore());

            CreateMap<GroupMember, GroupMemberResponse>();
            CreateMap<Group, GroupResponse>();

            // El perfil público es la copia sin los campos del manager: `PublicGroupResponse` no
            // declara `paymentInstructions`, así que el JSON anónimo no puede llevarlo (ronda 9).
            CreateMap<Group, PublicGroupResponse>();

            // Genre & Media maps
            CreateMap<GroupGenre, GenreResponse>()
                .ForMember(d => d.Id, o => o.MapFrom(s => s.Genre.Id))
                .ForMember(d => d.Name, o => o.MapFrom(s => s.Genre.Name))
                .ForMember(d => d.Slug, o => o.MapFrom(s => s.Genre.Slug))
                .ForMember(d => d.ColorHex, o => o.MapFrom(s => s.Genre.ColorHex))
                .ForMember(d => d.IsPrimary, o => o.MapFrom(s => s.IsPrimary));

            CreateMap<GroupMedia, GroupMediaResponse>()
                .ForMember(d => d.Type, o => o.MapFrom(s => s.Type.ToString().ToLower()))
                .ForMember(d => d.UploadedAt, o => o.MapFrom(s => s.CreatedAt.ToUniversalTime().ToString("o")))
                .ForMember(d => d.Description, o => o.MapFrom(s => s.Description));

            CreateMap<MusicGenre, GenreListResponse>();
        }
    }
}

