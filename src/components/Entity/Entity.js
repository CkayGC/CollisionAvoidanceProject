// 1. Import the asset file as a variable at the top
import entityImage from '../../assets/EntityIcon.avif';
// 2. Import your CSS file globally
import './Entity.css';

function Entity() {
  return (
    <img 
      src={entityImage}
      alt="Object"
      className="entityImage"
    >

    </img>
  );
}

export default Entity;
