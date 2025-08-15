import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { lichessStudies } from '../../../utils/api/lichessStudy.js';
import { drawBoard } from '../../../utils/drawBoard.js';

export default {
  data: new SlashCommandBuilder()
    .setName('study')
    .setDescription('Interact with Lichess studies')
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View a Lichess study or chapter')
        .addStringOption(option =>
          option
            .setName('url')
            .setDescription('Lichess study URL')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('Search for public Lichess studies')
        .addStringOption(option =>
          option
            .setName('query')
            .setDescription('Search query')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('results')
            .setDescription('Number of results (1-10)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const url = interaction.options.getString('url');
      const studyInfo = lichessStudies.extractStudyInfo(url);

      if (!studyInfo) {
        return interaction.editReply('Invalid Lichess study URL. Please provide a valid study link.');
      }

      try {
        const study = await lichessStudies.getStudy(studyInfo.studyId);
        if (!study) {
          return interaction.editReply('Study not found or is private.');
        }

        const parsedStudy = lichessStudies.parseStudyData(study);

        if (studyInfo.chapterId) {
          const chapter = await lichessStudies.getStudyChapter(studyInfo.studyId, studyInfo.chapterId);
          if (!chapter) {
            return interaction.editReply('Chapter not found.');
          }

          const parsedChapter = lichessStudies.parseChapterData(chapter);
          
          const boardOptions = {
            size: 400,
            flip: parsedChapter.orientation === 'black'
          };

          if (parsedChapter.arrows.length > 0) {
            boardOptions.bestMove = `${parsedChapter.arrows[0].from}${parsedChapter.arrows[0].to}`;
          }

          const boardBuffer = await drawBoard(parsedChapter.fen, boardOptions);

          const embed = new EmbedBuilder()
            .setTitle(`📚 ${parsedStudy.name}`)
            .setDescription(`**Chapter:** ${parsedChapter.name}`)
            .setImage('attachment://study_position.png')
            .setColor('#759e7a');

          if (parsedChapter.comments.length > 0) {
            const commentText = parsedChapter.comments
              .slice(0, 3)
              .map(comment => `**${comment.author || 'Author'}:** ${comment.text}`)
              .join('\n\n');
            
            embed.addFields({
              name: '💬 Comments',
              value: commentText.length > 1000 ? commentText.substring(0, 1000) + '...' : commentText,
              inline: false
            });
          }

          const components = [];
          if (parsedStudy.totalChapters > 1) {
            const navButton = new ButtonBuilder()
              .setCustomId(`study_chapters_${studyInfo.studyId}`)
              .setLabel(`View All Chapters (${parsedStudy.totalChapters})`)
              .setStyle(ButtonStyle.Secondary);

            components.push(new ActionRowBuilder().addComponents(navButton));
          }

          await interaction.editReply({
            embeds: [embed],
            files: [{ attachment: boardBuffer, name: 'study_position.png' }],
            components
          });

        } else {
          const embed = new EmbedBuilder()
            .setTitle(`📚 ${parsedStudy.name}`)
            .setDescription(parsedStudy.description || 'No description available')
            .addFields(
              { name: '👤 Author', value: parsedStudy.author, inline: true },
              { name: '📄 Chapters', value: parsedStudy.totalChapters.toString(), inline: true },
              { name: '👍 Likes', value: parsedStudy.likes.toString(), inline: true },
              { name: '👁️ Views', value: parsedStudy.views.toString(), inline: true },
              { name: '🔒 Visibility', value: parsedStudy.public ? 'Public' : 'Private', inline: true },
              { name: '📅 Updated', value: new Date(parsedStudy.updatedAt).toLocaleDateString(), inline: true }
            )
            .setColor('#759e7a')
            .setURL(studyInfo.url);

          if (parsedStudy.chapters.length > 0) {
            const chapterList = parsedStudy.chapters
              .slice(0, 10)
              .map((chapter, index) => `${index + 1}. ${chapter.name}`)
              .join('\n');

            embed.addFields({
              name: '📑 Chapters',
              value: chapterList,
              inline: false
            });
          }

          const chaptersButton = new ButtonBuilder()
            .setCustomId(`study_chapters_${studyInfo.studyId}`)
            .setLabel('Browse Chapters')
            .setStyle(ButtonStyle.Primary);

          const components = [new ActionRowBuilder().addComponents(chaptersButton)];

          await interaction.editReply({ embeds: [embed], components });
        }

        interaction.client.studyCache = interaction.client.studyCache || new Map();
        interaction.client.studyCache.set(studyInfo.studyId, parsedStudy);

      } catch (error) {
        console.error('Study view error:', error);
        await interaction.editReply('Error loading study. Please try again.');
      }
    }

    if (subcommand === 'search') {
      const query = interaction.options.getString('query');
      const maxResults = interaction.options.getInteger('results') || 5;

      try {
        const searchResults = await lichessStudies.searchStudies(query, { max: maxResults });
        
        if (!searchResults || searchResults.paginator?.nbResults === 0) {
          return interaction.editReply(`No studies found for "${query}".`);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🔍 Study Search: "${query}"`)
          .setColor('#759e7a');

        const results = searchResults.paginator.currentPageResults || [];
        
        if (results.length === 0) {
          embed.setDescription('No studies found matching your search.');
        } else {
          const studyFields = results.map(study => ({
            name: `📚 ${study.name}`,
            value: `**Author:** ${study.owner.name}\n**Chapters:** ${study.nbChapters}\n**Likes:** ${study.likes}\n[View Study](https://lichess.org/study/${study.id})`,
            inline: false
          }));

          embed.addFields(studyFields);
          
          if (searchResults.paginator.nbResults > maxResults) {
            embed.setFooter({ 
              text: `Showing ${maxResults} of ${searchResults.paginator.nbResults} results` 
            });
          }
        }

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        console.error('Study search error:', error);
        await interaction.editReply('Error searching studies. Please try again.');
      }
    }
  }
};

export async function handleStudyButtons(interaction) {
  const [action, type, studyId] = interaction.customId.split('_');
  
  if (action !== 'study' || type !== 'chapters') return;

  const study = interaction.client.studyCache?.get(studyId);
  if (!study) {
    return interaction.reply({ 
      content: 'Study data not found. Please view the study again.', 
      ephemeral: true 
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`📑 ${study.name} - Chapters`)
    .setColor('#759e7a');

  const chapterText = study.chapters.map((chapter, index) => {
    const orientation = chapter.orientation === 'black' ? '⚫' : '⚪';
    return `${orientation} **${index + 1}.** [${chapter.name}](https://lichess.org/study/${studyId}/${chapter.id})`;
  }).join('\n');

  embed.setDescription(chapterText || 'No chapters found');

  await interaction.reply({ embeds: [embed], ephemeral: true });
}