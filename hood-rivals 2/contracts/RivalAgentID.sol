// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/Base64.sol';

/// @notice One customizable identity per wallet, capped at 3,333. No gameplay power or financial rights.
/// @dev Tactical memory lives on the game server, keyed by token ID and rechecked against ownerOf.
contract RivalAgentID is ERC721, Ownable {
 using Strings for uint256;
 uint256 public constant MAX_SUPPLY = 3333;
 uint256 public minted;
 bool public mintOpen;
 struct Look {uint8 palette; uint8 crest; uint8 accessory;}
 mapping(uint256=>Look) private _looks;
 mapping(address=>uint256) public identityOf;
 event Customized(uint256 indexed tokenId,uint8 palette,uint8 crest,uint8 accessory);
 event MintOpenChanged(bool open);
 constructor(address owner_) ERC721('Hood Rivals Agent ID','HRA') Ownable(owner_) {}
 function setMintOpen(bool open) external onlyOwner {mintOpen=open;emit MintOpenChanged(open);}
 function _checkLook(uint8 palette,uint8 crest,uint8 accessory) internal pure {
  require(palette<4&&crest<4&&accessory<4,'look range');
 }
 function mint(uint8 palette,uint8 crest,uint8 accessory) external returns(uint256 id) {
  require(mintOpen,'mint closed');require(minted<MAX_SUPPLY,'sold out');require(identityOf[msg.sender]==0,'one identity per wallet');
  _checkLook(palette,crest,accessory);id=++minted;_looks[id]=Look(palette,crest,accessory);
  _safeMint(msg.sender,id);emit Customized(id,palette,crest,accessory);
 }
 function customize(uint256 id,uint8 palette,uint8 crest,uint8 accessory) external {
  require(ownerOf(id)==msg.sender,'owner only');_checkLook(palette,crest,accessory);
  _looks[id]=Look(palette,crest,accessory);emit Customized(id,palette,crest,accessory);
 }
 function lookOf(uint256 id) external view returns(uint8 palette,uint8 crest,uint8 accessory) {
  ownerOf(id);Look memory l=_looks[id];return(l.palette,l.crest,l.accessory);
 }
 function _update(address to,uint256 id,address auth) internal override returns(address from) {
  from=_ownerOf(id);
  if(to!=address(0)&&to!=from)require(identityOf[to]==0,'one identity per wallet');
  from=super._update(to,id,auth);
  if(from!=address(0)&&from!=to)identityOf[from]=0;
  if(to!=address(0))identityOf[to]=id;
 }
 function tokenURI(uint256 id) public view override returns(string memory) {
  ownerOf(id);Look memory l=_looks[id];
  string memory color=l.palette==0?'#c7f76d':l.palette==1?'#5ee5c2':l.palette==2?'#f6c478':'#ce9cff';
  string memory crest=l.crest==0?'H':l.crest==1?'X':l.crest==2?'V':'O';
  string memory accessory=l.accessory==0?'_':l.accessory==1?'*':l.accessory==2?'+':'^';
  string memory svg=string.concat('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 32 32" shape-rendering="crispEdges"><rect width="32" height="32" fill="#0d1a18"/><path d="M3 25 16 19 29 25V32H3Z" fill="#243a2d"/><path d="M8 9H24V25H8Z" fill="',color,'"/><path d="M10 7H22V11H10ZM12 5H20V7H12Z" fill="#f9f1d4"/><rect x="11" y="12" width="10" height="10" fill="#13251c"/><text x="16" y="20" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="7" fill="',color,'">',crest,'</text><text x="16" y="29" text-anchor="middle" font-family="monospace" font-size="5" fill="#f9f1d4">',accessory,'</text></svg>');
  string memory json=string.concat('{"name":"Hood Rivals Agent #',id.toString(),'","description":"Customizable game identity. Tactical memory is stored by the game server and follows verified token ownership; it is not stored onchain. No financial rights or gameplay power.","image":"data:image/svg+xml;base64,',Base64.encode(bytes(svg)),'","attributes":[{"trait_type":"Palette","value":"',uint256(l.palette).toString(),'"},{"trait_type":"Crest","value":"',uint256(l.crest).toString(),'"},{"trait_type":"Accessory","value":"',uint256(l.accessory).toString(),'"}]}');
  return string.concat('data:application/json;base64,',Base64.encode(bytes(json)));
 }
}
