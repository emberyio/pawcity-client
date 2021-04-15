
/**
 * @author Tanya Vykliuk <tanya.vykliuk@gmail.com>
 */
import React, { useEffect } from "react";

import Dashboard  from "@xr3ngine/client-core/src/socialmedia/components/Dashboard";
import ClipConsole  from "@xr3ngine/client-core/src/admin/components/ClipConsole";
import { bindActionCreators, Dispatch } from "redux";
import { connect } from "react-redux";
import { selectFeedsState } from "@xr3ngine/client-core/src/socialmedia/reducers/feed/selector";
import { getFeeds } from "@xr3ngine/client-core/src/socialmedia/reducers/feed/service";

const mapStateToProps = (state: any): any => {
  return {
      feedsState: selectFeedsState(state),
  };
};

const mapDispatchToProps = (dispatch: Dispatch): any => ({
  getFeeds: bindActionCreators(getFeeds, dispatch),
});
interface Props{
  feedsState?: any,
  getFeeds?: any
}

 const FeedsPage = ({feedsState, getFeeds}:Props) => {
    useEffect(()=> getFeeds('admin'), []);
    const feedsList = feedsState.get('fetching') === false && feedsState?.get('feedsAdmin') ? feedsState.get('feedsAdmin') : null;
   return (<>
    <div>
      <Dashboard>
          {feedsList && <ClipConsole list={feedsList}/>}
        </Dashboard>
    </div>
  </>
  );
};

export default connect(mapStateToProps, mapDispatchToProps)(FeedsPage);