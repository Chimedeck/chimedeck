// Re-export board member handlers from the members/ sub-directory.
// This shim exists because TypeScript resolves `./members` to this file before `./members/index`.
export {
  handleGetBoardMembers,
  handleAddBoardMember,
  handleUpdateBoardMember,
  handleRemoveBoardMember,
} from './members/index';
