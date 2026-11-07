using NitroGroups.Shared.Domain;
using NitroGroups.Shared.Domain.DomainEvents.Users;

namespace NitroGroups.Core.Users.Domain.Entities
﻿{
﻿    public class Musician : DomainModel
﻿    {
﻿        public long UserId { get; set; }
﻿        public int YearsExperience { get; set; }
﻿        public string? ShortBio { get; set; }
﻿        public bool IsOpenToJoin { get; set; }

        /// <summary>Short title the musician leads with. Max 120 characters.</summary>
        public string? Headline { get; set; }

        /// <summary>Instruments the musician plays, as free text. Max 120 characters.</summary>
        public string? Instruments { get; set; }

        /// <summary>Link to a video or audio sample. Max 300 characters.</summary>
        public string? VideoUrl { get; set; }

        public virtual User User { get; set; } = null!;

        /// <summary>
        /// Applies a partial update of the public profile: a null field means "leave it as it is",
        /// so sending only one field never erases the rest.
        /// </summary>
        public void UpdateProfile(
            string? headline,
            string? shortBio,
            string? instruments,
            int? yearsExperience,
            string? videoUrl,
            bool? isOpenToJoin)
        {
            if (headline is not null) Headline = headline;
            if (shortBio is not null) ShortBio = shortBio;
            if (instruments is not null) Instruments = instruments;
            if (yearsExperience is not null) YearsExperience = yearsExperience.Value;
            if (videoUrl is not null) VideoUrl = videoUrl;
            if (isOpenToJoin is not null) IsOpenToJoin = isOpenToJoin.Value;
        }

        public void RaiseMusicianWithGroupCreatedEvent(int idGroup) =>
            AddDomainEvent(new MusicianWithGroupCreatedEvent(UserId, idGroup));
        
        public void RaiseSoloMusicianCreatedEvent(string groupName) =>
            AddDomainEvent(new SoloMusicianCreatedEvent(UserId, groupName));
    }
﻿}
﻿